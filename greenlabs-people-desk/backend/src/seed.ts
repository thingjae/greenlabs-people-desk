import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcryptjs';
import { pool, q, one, migrate } from './db';
import { normalizePhone, today, addBizDays, ymd } from './util';
import { ingestDocument } from './documents';

const DATA = path.join(__dirname, '..', 'seed-data');
const xdate = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return ymd(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; }
  return String(v).slice(0, 10);
};

export async function seed(force = false) {
  await migrate();
  const exists = await one(`SELECT count(*)::int n FROM users`);
  if (exists.n > 0 && !force) { console.log('seed: 이미 데이터가 있어 건너뜀'); return; }
  if (force) {
    await q(`TRUNCATE qa_logs, doc_chunks, documents, email_logs, email_templates, intake_drafts, interviews, availabilities,
      evaluation_revisions, evaluations, eval_criteria, stage_histories, applicants, position_interviewers, positions, users, settings RESTART IDENTITY CASCADE`);
  }
  const hash = await bcrypt.hash('demo1234', 8);
  const users = [
    ['서지원', 'seo@greenlabs.test', 'PEOPLE', '정규직', '피플팀 매니저'],
    ['최현아', 'head@greenlabs.test', 'PEOPLE', '정규직', '피플팀장'],
    ['이서진', 'yi@greenlabs.test', 'PEOPLE', '정규직', '피플팀 매니저'],
    ['박도현', 'park@greenlabs.test', 'INTERVIEWER', '정규직', '개발팀장'],
    ['이서준', 'lee@greenlabs.test', 'INTERVIEWER', '정규직', '플랫폼개발팀'],
    ['한지민', 'han@greenlabs.test', 'INTERVIEWER', '정규직', '플랫폼개발팀'],
    ['송유나', 'song@greenlabs.test', 'INTERVIEWER', '정규직', '디자인팀장'],
    ['김정규', 'emp1@greenlabs.test', 'EMPLOYEE', '정규직', '사업개발팀'],
    ['한수습', 'emp2@greenlabs.test', 'EMPLOYEE', '수습', '프로덕트팀 (입사 2개월)'],
  ];
  const uid: Record<string, number> = {};
  for (const [name, email, role, et, title] of users) {
    const r = await one(`INSERT INTO users(name,email,password_hash,role,employment_type,title) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [name, email, hash, role, et, title]);
    uid[email] = r.id;
  }

  // 포지션·지원자
  const wb = XLSX.readFile(path.join(DATA, 'positions_applicants.xlsx'));
  const posRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['포지션']);
  for (const p of posRows) {
    await q(`INSERT INTO positions(id,name,department,headcount,opened_at,has_task,interview_minutes,status) VALUES($1,$2,$3,$4,$5,$6,60,$7)`,
      [p['포지션ID'], p['포지션명'], p['부서'], p['채용 인원'], xdate(p['오픈일']), p['과제 전형'] === 'O', p['상태']]);
  }
  // 면접관 배정 (포지션 시트의 면접관 이름 중 데모 계정이 있는 사람만 계정으로 연결)
  const assign: [string, string, string][] = [
    ['P01', 'lee@greenlabs.test', 'FIRST'], ['P01', 'han@greenlabs.test', 'FIRST'], ['P01', 'park@greenlabs.test', 'SECOND'],
    ['P02', 'park@greenlabs.test', 'SECOND'], ['P04', 'park@greenlabs.test', 'SECOND'], ['P03', 'song@greenlabs.test', 'SECOND'],
  ];
  for (const [pid, email, st] of assign) await q(`INSERT INTO position_interviewers(position_id,user_id,stage) VALUES($1,$2,$3)`, [pid, uid[email], st]);

  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['지원자'], { defval: null });
  for (const r of rows) {
    const notes: string[] = [];
    if (r['메모']) notes.push(r['메모']);
    let needs = false;
    if (!r['현재 단계']) { needs = true; if (!notes.some((n) => n.includes('단계'))) notes.push('[확인 필요] 현재 단계 누락'); }
    if (!r['지원 경로']) { needs = true; if (!notes.some((n) => n.includes('경로'))) notes.push('[확인 필요] 지원 경로 누락'); }
    await q(`INSERT INTO applicants(id,position_id,name,email,phone,source,applied_at,stage,status,end_stage,end_reason,stage_changed_at,task_due_at,task_submitted_at,result_notified_at,needs_review,review_note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [r['지원자ID'], r['포지션ID'], r['이름'], r['이메일'], normalizePhone(r['연락처']), r['지원 경로'], xdate(r['지원일']), r['현재 단계'], r['상태'],
        r['종료 단계'], r['종료 사유'], xdate(r['단계 변경일']), xdate(r['과제 마감일']), xdate(r['과제 제출일']), xdate(r['결과 안내일']), needs, notes.join(' / ') || null]);
  }
  // 처우 협의 지원자에게 연봉 예시 (피플팀만 열람)
  await q(`UPDATE applicants SET salary_offer='희망 6,000만 원 / 제시 5,800만 원 (가상)' WHERE stage='처우 협의'`);

  // 평가 기준표
  const ev = XLSX.readFile(path.join(DATA, 'interview_eval_criteria.xlsx'));
  const scale: Record<string, [number, number]> = { P01: [1, 5], P02: [1, 5], P03: [1, 5], P04: [1, 5], P05: [1, 4], P06: [1, 3] };
  for (const name of ev.SheetNames) {
    const pid = name.slice(0, 3);
    if (!scale[pid]) continue;
    const arr: any[][] = XLSX.utils.sheet_to_json(ev.Sheets[name], { header: 1, defval: null });
    const head = arr[1];
    let order = 0;
    for (const row of arr.slice(2)) {
      if (!row[0] || !row[1] || typeof row[3] !== 'number') continue;
      await q(`INSERT INTO eval_criteria(position_id,stage,item,description,weight,scale_min,scale_max,scale_labels,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [pid, row[0], row[1], row[2], row[3], scale[pid][0], scale[pid][1], JSON.stringify({ [head[4]]: row[4], [head[5]]: row[5], [head[6]]: row[6] }), order++]);
    }
  }

  // 시연용: 1차·2차 면접 진행 중 지원자에게 이서준·박도현 평가 일부와 가능 시간
  const t = today();
  const nextWeek = (dow: number, hour: number) => { const d = new Date(t); const diff = ((dow - d.getUTCDay() + 7) % 7) || 7; d.setUTCDate(d.getUTCDate() + diff + (diff < 3 ? 7 : 0)); d.setUTCHours(hour - 9, 0, 0, 0); return d; };
  for (const email of ['lee@greenlabs.test', 'han@greenlabs.test', 'park@greenlabs.test']) {
    const slots = email === 'park@greenlabs.test' ? [[2, 14], [2, 15], [3, 10], [3, 16]] : email === 'lee@greenlabs.test' ? [[2, 14], [2, 15], [3, 16], [4, 11]] : [[2, 15], [3, 16], [4, 11]];
    for (const [dow, h] of slots) { const s = nextWeek(dow, h); await q(`INSERT INTO availabilities(interviewer_id,start_at,end_at) VALUES($1,$2,$3)`, [uid[email], s, new Date(s.getTime() + 3600e3)]); }
  }

  // 메일 템플릿
  const tpl = [
    ['접수', '[그린랩스] {{포지션}} 지원서 접수 안내', '{{이름}}님, 그린랩스 {{포지션}} 포지션에 지원해 주셔서 감사합니다.\n서류 검토 결과는 5영업일 안에 안내드리겠습니다.\n\n그린랩스 피플팀 드림'],
    ['과제', '[그린랩스] {{포지션}} 과제 전형 안내', '{{이름}}님, 서류 전형에 합격하셨습니다.\n과제는 {{일시}}까지 제출해 주세요. 기한 연장이 필요하면 미리 회신 부탁드립니다.\n\n그린랩스 피플팀 드림'],
    ['면접 일정', '[그린랩스] {{포지션}} 면접 일정 확정 안내', '{{이름}}님, 면접 일정이 {{일시}}로 확정되었습니다.\n장소와 준비물은 별도로 안내드리겠습니다. 일정 변경이 필요하면 회신 부탁드립니다.\n\n그린랩스 피플팀 드림'],
    ['합격', '[그린랩스] {{포지션}} 전형 합격 안내', '{{이름}}님, {{포지션}} 전형에 합격하셨습니다. 축하드립니다.\n다음 절차는 피플팀이 따로 연락드리겠습니다.\n\n그린랩스 피플팀 드림'],
    ['불합격', '[그린랩스] {{포지션}} 전형 결과 안내', '{{이름}}님, 그린랩스 {{포지션}} 포지션에 관심을 가져 주셔서 감사합니다.\n신중히 검토한 끝에 이번에는 함께하기 어렵다는 결론을 내렸습니다.\n지원해 주신 시간과 노력에 다시 한번 감사드리며, 앞으로의 여정을 응원하겠습니다.\n\n그린랩스 피플팀 드림'],
  ];
  for (const [type, s, b] of tpl) await q(`INSERT INTO email_templates(type,subject,body) VALUES($1,$2,$3)`, [type, s, b]);

  for (const [k, v] of [['result_notice_bizdays', '5'], ['eval_due_bizdays', '2'], ['interview_minutes', '60'], ['retention_days', '180']])
    await q(`INSERT INTO settings(key,value) VALUES($1,$2)`, [k, v]);

  // 문서: 규정집은 구버전으로 시작 (개정판은 시연 중 업로드)
  const docs = [
    ['규정집', '사내 규정집', '2026-03-01', 'rules_2026-03-01_old.pdf'],
    ['복지 가이드', '복지 가이드', '2026-01-02', 'welfare_guide_2026-01-02.pdf'],
    ['경비 지침', '경비 처리 지침', '2026-07-01', 'expense_guideline_2026-07-01.pdf'],
  ];
  for (const [docType, title, revisedAt, file] of docs) {
    const r = await ingestDocument({ buf: fs.readFileSync(path.join(DATA, file)), docType, title, revisedAt, fileName: file });
    console.log(`seed: ${title} ${r.chunks}개 조각 (임베딩 ${r.embedded ? 'O' : 'X'})`);
  }
  console.log(`seed: 완료 — 사용자 ${users.length}, 지원자 ${rows.length}`);
}

if (require.main === module) {
  seed(process.argv.includes('--force')).then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
