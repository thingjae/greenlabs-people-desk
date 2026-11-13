import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { q, one } from './db';
import { AuthUser, CurrentUser, Roles } from './auth';
import { aiEnabled, chatJson, cosine, embed, keywordScore } from './ai';
import { ingestDocument } from './documents';
import { SOURCES, normalizePhone, digits, today, ymd, toDate } from './util';

// ---------- 민감 질문 (B16) ----------
const SENSITIVE = ['아파', '아프', '아픈', '병원', '진단', '질병', '투병', '수술', '입원', '우울', '공황', '정신과', '심리 상담', '임신', '유산', '난임', '이혼', '가정 문제', '가족 문제', '집안 사정', '간병', '징계', '해고', '괴롭힘', '성희롱', '폭언', '갑질', '신고', '남의 연봉', '연봉이 얼마', '월급이 얼마', '급여가 얼마'];
const sensitiveHit = (s: string) => SENSITIVE.find((k) => s.includes(k));

const DOC_TYPES = ['규정집', '복지 가이드', '경비 지침'];
const DOC_TITLE: Record<string, string> = { 규정집: '사내 규정집', '복지 가이드': '복지 가이드', '경비 지침': '경비 처리 지침' };

@Controller()
export class SupportController {
  // ---------- 문서 (B14) ----------
  @Get('documents')
  async documents() {
    return q(`SELECT d.*, (SELECT count(*)::int FROM doc_chunks c WHERE c.document_id=d.id) chunks FROM documents d ORDER BY doc_type, version DESC`);
  }

  @Post('documents')
  @Roles('PEOPLE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() b: { docType: string; revisedAt: string; title?: string }) {
    if (!file) throw new BadRequestException('PDF 파일을 골라 주세요');
    if (!/\.pdf$/i.test(file.originalname) && file.mimetype !== 'application/pdf') throw new BadRequestException('PDF 파일만 올릴 수 있습니다');
    if (!DOC_TYPES.includes(b.docType)) throw new BadRequestException('문서 종류를 골라 주세요');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.revisedAt || '')) throw new BadRequestException('개정일을 입력해 주세요 (필수)');
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return ingestDocument({ buf: file.buffer, docType: b.docType, title: b.title || DOC_TITLE[b.docType], revisedAt: b.revisedAt, fileName: name, uploadedBy: user.id });
  }

  /** 이전 버전으로 되돌리기: 같은 종류의 다른 문서는 보관, 이 문서를 답변에 사용 */
  @Post('documents/:id/activate')
  @Roles('PEOPLE')
  async activate(@Param('id') id: string) {
    const d = await one(`SELECT * FROM documents WHERE id=$1`, [id]);
    if (!d) throw new BadRequestException('문서를 찾을 수 없습니다');
    await q(`UPDATE documents SET is_active=(id=$1) WHERE doc_type=$2`, [id, d.doc_type]);
    return { ok: true };
  }

  // ---------- 질문 답변 (AI-1, B15~B18) ----------
  @Post('qa/ask')
  async ask(@CurrentUser() user: AuthUser, @Body() b: { question: string }) {
    const question = (b.question || '').trim();
    if (!question) throw new BadRequestException('질문을 입력해 주세요');
    const me = await one(`SELECT employment_type FROM users WHERE id=$1`, [user.id]);
    const save = async (r: any) => {
      const row = await one(`INSERT INTO qa_logs(user_id,question,answer,citations,conflict,status,escalation_reason,is_sensitive) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [user.id, question, r.answer ?? null, JSON.stringify(r.citations || []), r.conflict ? JSON.stringify(r.conflict) : null, r.status, r.escalationReason ?? null, !!r.sensitive]);
      return { id: row.id, ...r };
    };
    const kw = sensitiveHit(question);
    if (kw) return save({ status: '이관', escalationReason: '민감', sensitive: true, answer: null, message: '개인 사정(건강·가족·징계 등)이 포함된 질문은 피플팀이 직접 비공개로 답드립니다. 피플팀에 전달했습니다.' });

    // 검색: 활성 문서 조각
    const chunks = await q(`SELECT c.*, d.title, d.doc_type, d.revised_at FROM doc_chunks c JOIN documents d ON d.id=c.document_id WHERE d.is_active`);
    const qv = aiEnabled() ? (await embed([question]))?.[0] : null;
    const scored = chunks.map((c) => {
      const k = keywordScore(question, c.article + ' ' + c.text);
      const e = qv && c.embedding ? cosine(qv, c.embedding) : null;
      return { ...c, score: e !== null ? e * 0.7 + k * 0.3 : k };
    }).sort((x, y) => y.score - x.score);
    const pick = new Map<number, any>();
    scored.slice(0, 6).forEach((c) => pick.set(c.id, c));
    for (const t of DOC_TYPES) scored.filter((c) => c.doc_type === t).slice(0, 2).forEach((c) => pick.set(c.id, c));
    const ctx = [...pick.values()].sort((x, y) => y.score - x.score);
    const cite = (c: any) => ({ chunkId: c.id, doc: c.title, revisedAt: ymd(toDate(c.revised_at)), article: c.article, page: c.page, quote: c.text.slice(0, 220) });

    if (!aiEnabled()) {
      // 대체 경로: 키워드 검색 결과만 근거로 보여 줌
      const top = ctx[0];
      if (!top || top.score < 0.3) return save({ status: '이관', escalationReason: '근거 없음', answer: null, message: '문서에서 근거를 찾지 못해 피플팀에 전달했습니다.' });
      return save({ status: '답변', answer: `관련 규정을 찾았습니다. 아래 근거를 확인해 주세요. (AI 키가 없어 키워드 검색 결과만 보여 줍니다)`, citations: ctx.slice(0, 2).map(cite), conflict: null, mode: 'keyword' });
    }

    const context = ctx.map((c, i) => `[C${i + 1}] 문서: ${c.title} (문서 개정일 ${ymd(toDate(c.revised_at))}) · ${c.article} · ${c.page}쪽\n${c.text}`).join('\n\n');
    const system = `너는 그린랩스 피플팀의 사내 규정 안내 도우미다. 반드시 지켜라.
1. 아래 [C번호] 조각에 적힌 내용으로만 답한다. 조각에 없는 내용은 추측하지 않는다. 답을 찾을 수 없으면 grounded=false.
2. 여러 문서가 같은 항목을 서로 다르게 적었으면, "문서 개정일"이 더 최근인 문서의 내용을 답으로 채택하고 conflict에 다른 문서의 내용을 적는다. (조항이 언제 바뀌었는지가 아니라 문서 전체의 개정일로 판단한다)
3. 한 문서에만 있는 항목은 충돌이 아니다.
4. 질문자의 고용 형태는 "${me?.employment_type || '정규직'}"이다. 고용 형태에 따라 다르면 질문자에게 해당하는 내용을 먼저 답하고 applies_to에 적용 대상을 적는다.
5. 질문에 본인이나 가족의 건강·질병, 가족 사정, 징계, 괴롭힘·성희롱 등 개인 사정이 들어 있으면 sensitive=true, answer는 빈 문자열.
6. 답은 2~4문장, 존댓말, 금액·일수는 숫자로.
JSON만 출력: {"sensitive":boolean,"grounded":boolean,"answer":string,"cited":["C1",...],"conflict":null 또는 {"topic":string,"chosen_doc":string,"chosen_value":string,"other_doc":string,"other_value":string},"applies_to":string 또는 null}`;
    const r = await chatJson(system, `질문: ${question}\n\n${context}`);
    if (!r) return save({ status: '이관', escalationReason: '근거 없음', answer: null, message: '지금은 답변을 만들 수 없어 피플팀에 전달했습니다.' });
    if (r.sensitive) return save({ status: '이관', escalationReason: '민감', sensitive: true, answer: null, message: '개인 사정이 포함된 질문은 피플팀이 직접 비공개로 답드립니다. 피플팀에 전달했습니다.' });
    const cited = (r.cited || []).map((s: string) => ctx[Number(String(s).replace(/\D/g, '')) - 1]).filter(Boolean);
    if (!r.grounded || cited.length === 0) return save({ status: '이관', escalationReason: '근거 없음', answer: null, message: '문서에서 근거를 찾지 못해 피플팀에 전달했습니다. 피플팀이 확인 후 답드립니다.' });
    // B15 서버 재확인: 채택 문서의 개정일이 다른 문서보다 최신인지
    let conflict = null;
    if (r.conflict && r.conflict.other_doc) {
      const rev = (title: string) => { const c = chunks.find((x) => title && (x.title === title || title.includes(x.title) || x.title.includes(title))); return c ? ymd(toDate(c.revised_at)) : null; };
      const chosenRev = rev(r.conflict.chosen_doc), otherRev = rev(r.conflict.other_doc);
      if (chosenRev && otherRev && chosenRev < otherRev) {
        return save({ status: '이관', escalationReason: '문서 충돌 확인 필요', answer: null, message: '문서끼리 내용이 달라 피플팀 확인이 필요합니다. 피플팀에 전달했습니다.' });
      }
      conflict = { ...r.conflict, chosen_revised_at: chosenRev, other_revised_at: otherRev };
    }
    return save({ status: '답변', answer: r.answer, citations: cited.map(cite), conflict, appliesTo: r.applies_to || null, mode: 'ai' });
  }

  @Get('qa/logs')
  async logs(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const rows = await q(`SELECT l.*, u.name user_name, u.employment_type FROM qa_logs l JOIN users u ON u.id=l.user_id ${user.role === 'PEOPLE' ? '' : 'WHERE l.user_id=$1'} ORDER BY created_at DESC LIMIT 200`, user.role === 'PEOPLE' ? [] : [user.id]);
    return rows.filter((r) => !status || r.status === status);
  }
  @Post('qa/logs/:id/resolve')
  @Roles('PEOPLE')
  async resolve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: { answer?: string }) {
    // 이관된 질문에 피플팀이 직접 답을 남기면 질문한 직원의 '내 문의'에 보임
    const reply = b.answer?.trim() ? `[피플팀 답변 · ${user.name}] ${b.answer.trim()}` : null;
    await q(`UPDATE qa_logs SET resolved_at=now(), answer=COALESCE($1, answer) WHERE id=$2`, [reply, id]);
    return { ok: true };
  }

  // ---------- 지원서 자동 입력 (AI-2, B10·B11·B12) ----------
  @Post('intake/extract')
  @Roles('PEOPLE')
  async extract(@Body() b: { rawText: string }) {
    const parts = (b.rawText || '').split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) throw new BadRequestException('지원서 내용을 붙여 넣어 주세요');
    const positions = await q(`SELECT id, name FROM positions`);
    const out = [];
    for (const raw of parts.slice(0, 10)) {
      let ex: any = regexExtract(raw, positions);
      const low: string[] = [];
      if (aiEnabled()) {
        const r = await chatJson(
          `채용 사이트에서 온 지원서 메일에서 항목을 뽑는다. 본문에 없는 값은 null. 추측하지 않는다.
position_id는 다음 중 하나만: ${positions.map((p) => `${p.id}=${p.name}`).join(', ')}.
source는 다음 중 하나만: ${SOURCES.join(', ')}.
applied_at은 YYYY-MM-DD. 확신이 낮은 필드는 low_confidence 배열에 넣는다.
JSON만: {"name":string|null,"email":string|null,"phone":string|null,"source":string|null,"position_id":string|null,"applied_at":string|null,"low_confidence":[string]}`, raw);
        if (r) { ex = { ...ex, ...Object.fromEntries(Object.entries(r).filter(([k, v]) => v !== null && k !== 'low_confidence')) }; low.push(...(r.low_confidence || [])); }
      }
      // 검증: 본문에 실제로 있는 이메일인지, 목록 안의 값인지
      if (ex.email && !raw.toLowerCase().includes(String(ex.email).toLowerCase())) { low.push('email'); }
      if (ex.source && !SOURCES.includes(ex.source)) { ex.source = null; }
      if (ex.position_id && !positions.find((p) => p.id === ex.position_id)) { ex.position_id = null; }
      ex.phone = ex.phone ? normalizePhone(ex.phone) : null;
      for (const k of ['name', 'email', 'phone', 'source', 'position_id']) if (!ex[k] && !low.includes(k)) low.push(k);
      const dup = ex.email ? await q(`SELECT id FROM applicants WHERE lower(email)=lower($1)`, [ex.email]) : [];
      const sus = ex.name && ex.phone ? (await q(`SELECT id, phone, email FROM applicants WHERE name=$1`, [ex.name])).filter((x) => digits(x.phone) === digits(ex.phone) && x.email.toLowerCase() !== String(ex.email || '').toLowerCase()) : [];
      const d = await one(`INSERT INTO intake_drafts(raw_text,extracted,low_confidence,duplicate_ids,suspect_ids) VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [raw, JSON.stringify(ex), JSON.stringify([...new Set(low)]), JSON.stringify(dup.map((x) => x.id)), JSON.stringify(sus.map((x) => x.id))]);
      out.push(d);
    }
    return out;
  }
  @Get('intake')
  @Roles('PEOPLE')
  async drafts(@Query('status') status = '대기') {
    return q(`SELECT * FROM intake_drafts WHERE status=$1 ORDER BY created_at DESC`, [status]);
  }
  @Post('intake/:id/approve')
  @Roles('PEOPLE')
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: any) {
    const d = await one(`SELECT * FROM intake_drafts WHERE id=$1`, [id]);
    if (!d || d.status !== '대기') throw new BadRequestException('대기 중인 지원서가 아닙니다');
    const v = { ...d.extracted, ...b };
    const miss = [['name', '이름'], ['email', '이메일'], ['position_id', '포지션'], ['source', '지원 경로']].filter(([k]) => !v[k]).map(([, n]) => n);
    if (miss.length) throw new BadRequestException(`필수 항목을 채워 주세요: ${miss.join(', ')}`);
    if (!SOURCES.includes(v.source)) throw new BadRequestException('지원 경로 값이 올바르지 않습니다');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new BadRequestException('이메일 형식이 올바르지 않습니다');
    const last = await one(`SELECT max(substring(id from 2)::int) n FROM applicants`);
    const newId = 'A' + String((last?.n || 0) + 1).padStart(4, '0');
    const t = ymd(today());
    await q(`INSERT INTO applicants(id,position_id,name,email,phone,source,applied_at,stage,status,stage_changed_at,needs_review) VALUES($1,$2,$3,$4,$5,$6,$7,'서류','진행 중',$8,false)`,
      [newId, v.position_id, v.name, v.email, normalizePhone(v.phone), v.source, v.applied_at || t, t]);
    await q(`INSERT INTO stage_histories(applicant_id,from_stage,to_stage,changed_by,reason) VALUES($1,null,'서류',$2,'지원서 자동 입력 승인')`, [newId, user.id]);
    await q(`UPDATE intake_drafts SET status='승인', decided_by=$1, decided_at=now(), applicant_id=$2, extracted=$3 WHERE id=$4`, [user.id, newId, JSON.stringify(v), id]);
    return { ok: true, applicantId: newId };
  }
  @Post('intake/:id/reject')
  @Roles('PEOPLE')
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await q(`UPDATE intake_drafts SET status='반려', decided_by=$1, decided_at=now() WHERE id=$2 AND status='대기'`, [user.id, id]);
    return { ok: true };
  }

  // ---------- 메일 (AI-3: 템플릿 치환, B20) ----------
  @Get('templates')
  @Roles('PEOPLE')
  async templates() { return q(`SELECT * FROM email_templates ORDER BY id`); }
  @Put('templates/:id')
  @Roles('PEOPLE')
  async saveTemplate(@Param('id') id: string, @Body() b: { subject: string; body: string }) {
    await q(`UPDATE email_templates SET subject=$1, body=$2 WHERE id=$3`, [b.subject, b.body, id]);
    return { ok: true };
  }
  @Post('emails/draft')
  @Roles('PEOPLE')
  async draft(@CurrentUser() user: AuthUser, @Body() b: { applicantId: string; type: string; when?: string }) {
    const a = await one(`SELECT a.*, p.name position_name FROM applicants a JOIN positions p ON p.id=a.position_id WHERE a.id=$1`, [b.applicantId]);
    const t = await one(`SELECT * FROM email_templates WHERE type=$1`, [b.type]);
    if (!a || !t) throw new BadRequestException('지원자 또는 템플릿을 찾을 수 없습니다');
    const when = b.when || (b.type === '과제' && a.task_due_at ? ymd(toDate(a.task_due_at)) : '(일시 입력)');
    const fill = (s: string) => s.replace(/{{이름}}/g, a.name).replace(/{{포지션}}/g, a.position_name).replace(/{{일시}}/g, when);
    return one(`INSERT INTO email_logs(applicant_id,type,subject,body,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`, [a.id, b.type, fill(t.subject), fill(t.body), user.id]);
  }
  @Get('emails')
  @Roles('PEOPLE')
  async emails(@Query('status') status?: string) {
    return q(`SELECT e.*, a.name applicant_name, a.position_id FROM email_logs e JOIN applicants a ON a.id=e.applicant_id ${status ? 'WHERE e.status=$1' : ''} ORDER BY e.created_at DESC LIMIT 200`, status ? [status] : []);
  }
  @Post('emails/:id/sent')
  @Roles('PEOPLE')
  async markSent(@Param('id') id: string, @Body() b: { subject?: string; body?: string }) {
    const e = await one(`UPDATE email_logs SET status='발송 완료', sent_at=now(), subject=COALESCE($1,subject), body=COALESCE($2,body) WHERE id=$3 RETURNING *`, [b.subject || null, b.body || null, id]);
    if (!e) throw new BadRequestException('메일을 찾을 수 없습니다');
    if (e.type === '불합격') await q(`UPDATE applicants SET result_notified_at=$1 WHERE id=$2`, [ymd(today()), e.applicant_id]);
    return { ok: true };
  }

  // ---------- 설정 ----------
  @Get('settings')
  @Roles('PEOPLE')
  async settings() { return q(`SELECT * FROM settings ORDER BY key`); }
  @Put('settings')
  @Roles('PEOPLE')
  async saveSettings(@Body() b: Record<string, string>) {
    for (const [k, v] of Object.entries(b)) {
      if (!/^\d+$/.test(String(v))) throw new BadRequestException(`${k} 값은 숫자여야 합니다`);
      await q(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2`, [k, String(v)]);
    }
    return { ok: true };
  }
}

/** AI 없이도 동작하는 기본 추출 (AI 결과가 있으면 덮어씀) */
function regexExtract(raw: string, positions: any[]) {
  const email = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || null;
  const phone = raw.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] || null;
  const name = raw.match(/(?:이름|성명|지원자명|지원자)\s*[:：]?\s*([가-힣]{2,4})/)?.[1] || null;
  const source = SOURCES.find((s) => raw.includes(s)) || null;
  const pos = positions.find((p) => raw.includes(p.name)) || null;
  const date = raw.match(/(20\d{2})[-./년]\s?(\d{1,2})[-./월]\s?(\d{1,2})/);
  return { name, email, phone, source, position_id: pos?.id || null, applied_at: date ? `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}` : null };
}
