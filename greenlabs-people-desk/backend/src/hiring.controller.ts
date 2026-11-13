import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { q, one } from './db';
import { AuthUser, CurrentUser, Roles, allowedPositions, assertApplicantAccess } from './auth';
import { flowFor, FLOW, ymd, toDate } from './util';
import { setting } from './applicants.controller';

const SK: Record<string, string> = { '1차 면접': 'FIRST', '2차 면접': 'SECOND' };

@Controller()
export class HiringController {
  // ---------- 평가 (B6·B7·B8) ----------
  @Get('applicants/:id/criteria')
  @Roles('PEOPLE', 'INTERVIEWER')
  async criteria(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('stage') stage: string) {
    const a = await assertApplicantAccess(user, id);
    return q(`SELECT * FROM eval_criteria WHERE position_id=$1 AND stage=$2 ORDER BY sort_order`, [a.position_id, stage]);
  }

  @Get('applicants/:id/evaluations')
  @Roles('PEOPLE', 'INTERVIEWER')
  async evaluations(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const a = await assertApplicantAccess(user, id);
    const rows = await q(`SELECT e.*, u.name interviewer_name FROM evaluations e JOIN users u ON u.id=e.interviewer_id WHERE applicant_id=$1 ORDER BY stage, submitted_at`, [id]);
    const crit = await q(`SELECT * FROM eval_criteria WHERE position_id=$1`, [a.position_id]);
    const weighted = (e: any) => {
      let s = 0, w = 0;
      for (const c of crit.filter((c) => c.stage === e.stage)) {
        const v = e.scores?.[c.id]?.score;
        if (typeof v === 'number') { s += ((v - c.scale_min) / (c.scale_max - c.scale_min)) * 100 * c.weight; w += c.weight; }
      }
      return w ? Math.round(s / w) : null;
    };
    const mineSubmitted = (stage: string) => rows.some((r) => r.interviewer_id === user.id && r.stage === stage && r.submitted_at);
    return rows.map((r) => {
      const hidden = user.role === 'INTERVIEWER' && r.interviewer_id !== user.id && !mineSubmitted(r.stage);
      if (hidden) return { id: r.id, stage: r.stage, interviewerName: r.interviewer_name, submitted: !!r.submitted_at, hidden: true };
      return { id: r.id, stage: r.stage, interviewerId: r.interviewer_id, interviewerName: r.interviewer_name, scores: r.scores, verdict: r.verdict, submittedAt: r.submitted_at, score100: weighted(r), hidden: false };
    });
  }

  @Post('evaluations')
  @Roles('INTERVIEWER')
  async submitEval(@CurrentUser() user: AuthUser, @Body() b: { applicantId: string; stage: string; scores: Record<string, { score: number; note: string }>; verdict: string }) {
    const a = await assertApplicantAccess(user, b.applicantId);
    if (!SK[b.stage]) throw new BadRequestException('면접 단계만 평가할 수 있습니다');
    const assigned = await one(`SELECT 1 FROM position_interviewers WHERE position_id=$1 AND user_id=$2 AND stage=$3`, [a.position_id, user.id, SK[b.stage]]);
    if (!assigned) throw new ForbiddenException(`${b.stage} 면접관으로 배정되지 않았습니다`);
    if (!['합격', '보류', '불합격'].includes(b.verdict)) throw new BadRequestException('종합 의견(합격/보류/불합격)을 골라 주세요');
    const crit = await q(`SELECT * FROM eval_criteria WHERE position_id=$1 AND stage=$2`, [a.position_id, b.stage]);
    for (const c of crit) {
      const s = b.scores?.[c.id];
      if (!s || typeof s.score !== 'number') throw new BadRequestException(`'${c.item}' 점수를 입력해 주세요`);
      if (s.score < c.scale_min || s.score > c.scale_max || !Number.isInteger(s.score)) throw new BadRequestException(`'${c.item}' 점수는 ${c.scale_min}~${c.scale_max} 사이여야 합니다`);
      if (!s.note || !s.note.trim()) throw new BadRequestException(`'${c.item}' 근거를 적어 주세요`);
    }
    const prev = await one(`SELECT * FROM evaluations WHERE applicant_id=$1 AND interviewer_id=$2 AND stage=$3`, [b.applicantId, user.id, b.stage]);
    if (prev) {
      await q(`INSERT INTO evaluation_revisions(evaluation_id,before,edited_by) VALUES($1,$2,$3)`, [prev.id, JSON.stringify({ scores: prev.scores, verdict: prev.verdict, submitted_at: prev.submitted_at }), user.id]);
      await q(`UPDATE evaluations SET scores=$1, verdict=$2, submitted_at=COALESCE(submitted_at, now()), updated_at=now() WHERE id=$3`, [JSON.stringify(b.scores), b.verdict, prev.id]);
      return { ok: true, revised: true };
    }
    await q(`INSERT INTO evaluations(applicant_id,interviewer_id,stage,scores,verdict,submitted_at) VALUES($1,$2,$3,$4,$5,now())`, [b.applicantId, user.id, b.stage, JSON.stringify(b.scores), b.verdict]);
    return { ok: true, revised: false };
  }

  @Get('evaluations/:id/revisions')
  @Roles('PEOPLE')
  async revisions(@Param('id') id: string) {
    return q(`SELECT r.*, u.name editor FROM evaluation_revisions r JOIN users u ON u.id=r.edited_by WHERE evaluation_id=$1 ORDER BY edited_at DESC`, [id]);
  }

  // ---------- 면접 일정 (B9) ----------
  @Get('availabilities')
  @Roles('PEOPLE', 'INTERVIEWER')
  async myAvail(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    const uid = user.role === 'PEOPLE' && userId ? Number(userId) : user.id;
    return q(`SELECT * FROM availabilities WHERE interviewer_id=$1 AND end_at > now() ORDER BY start_at`, [uid]);
  }
  @Post('availabilities')
  @Roles('INTERVIEWER')
  async addAvail(@CurrentUser() user: AuthUser, @Body() b: { startAt: string; endAt: string }) {
    const s = new Date(b.startAt), e = new Date(b.endAt);
    if (!(e > s)) throw new BadRequestException('끝 시간이 시작 시간보다 늦어야 합니다');
    const dup = await one(`SELECT id FROM availabilities WHERE interviewer_id=$1 AND start_at=$2`, [user.id, s]);
    if (dup) return dup;
    return one(`INSERT INTO availabilities(interviewer_id,start_at,end_at) VALUES($1,$2,$3) RETURNING *`, [user.id, s, e]);
  }
  @Delete('availabilities/:id')
  @Roles('INTERVIEWER')
  async delAvail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await q(`DELETE FROM availabilities WHERE id=$1 AND interviewer_id=$2`, [id, user.id]);
    return { ok: true };
  }

  private async commonSlots(positionId: string, stage: string) {
    const ivs = await q(`SELECT u.id, u.name FROM position_interviewers pi JOIN users u ON u.id=pi.user_id WHERE pi.position_id=$1 AND pi.stage=$2`, [positionId, SK[stage]]);
    if (ivs.length === 0) return { interviewers: [], slots: [] };
    const minutes = await setting('interview_minutes', 60); // 설정 화면의 면접 길이
    const avail = await q(`SELECT * FROM availabilities WHERE interviewer_id = ANY($1) AND end_at > now()`, [ivs.map((i) => i.id)]);
    // 시작 후보: 각 가능 구간의 시작 시각. 모든 면접관의 구간에 [start, start+minutes]가 들어가면 후보
    const starts = [...new Set(avail.map((a) => new Date(a.start_at).getTime()))].sort();
    const slots = starts.filter((st) => ivs.every((iv) => avail.some((a) => a.interviewer_id === iv.id && new Date(a.start_at).getTime() <= st && new Date(a.end_at).getTime() >= st + minutes * 60e3)))
      .map((st) => ({ startAt: new Date(st).toISOString(), endAt: new Date(st + minutes * 60e3).toISOString() }));
    return { interviewers: ivs, slots, minutes };
  }

  @Get('interviews/slots')
  @Roles('PEOPLE')
  async slots(@Query('applicantId') applicantId: string, @Query('stage') stage: string) {
    const a = await one(`SELECT * FROM applicants WHERE id=$1`, [applicantId]);
    if (!a) throw new BadRequestException('지원자를 찾을 수 없습니다');
    if (!SK[stage]) throw new BadRequestException('면접 단계를 골라 주세요');
    return this.commonSlots(a.position_id, stage);
  }

  @Post('interviews')
  @Roles('PEOPLE')
  async confirm(@CurrentUser() user: AuthUser, @Body() b: { applicantId: string; stage: string; startAt: string }) {
    const a = await one(`SELECT a.*, p.name position_name FROM applicants a JOIN positions p ON p.id=a.position_id WHERE a.id=$1`, [b.applicantId]);
    if (!a) throw new BadRequestException('지원자를 찾을 수 없습니다');
    if (a.stage !== b.stage) throw new BadRequestException(`지원자가 ${b.stage} 단계가 아닙니다 (현재: ${a.stage || '없음'})`);
    const { interviewers, slots, minutes } = await this.commonSlots(a.position_id, b.stage);
    const st = new Date(b.startAt).getTime();
    if (!slots.some((s) => new Date(s.startAt).getTime() === st)) throw new BadRequestException('배정된 면접관 모두가 가능한 시간이 아닙니다');
    const iv = await one(`INSERT INTO interviews(applicant_id,stage,start_at,end_at,interviewer_ids,confirmed_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [a.id, b.stage, new Date(st), new Date(st + minutes * 60e3), JSON.stringify(interviewers.map((i) => i.id)), user.id]);
    // 확정한 시간은 면접관 가능 시간에서 뺀다
    await q(`DELETE FROM availabilities WHERE interviewer_id = ANY($1) AND start_at=$2`, [interviewers.map((i) => i.id), new Date(st)]);
    const tpl = await one(`SELECT * FROM email_templates WHERE type='면접 일정'`);
    const when = new Date(st + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
    const fill = (s: string) => s.replace(/{{이름}}/g, a.name).replace(/{{포지션}}/g, a.position_name).replace(/{{일시}}/g, `${when} (${b.stage})`);
    await q(`INSERT INTO email_logs(applicant_id,type,subject,body,created_by) VALUES($1,'면접 일정',$2,$3,$4)`, [a.id, fill(tpl.subject), fill(tpl.body), user.id]);
    return { ok: true, interview: iv };
  }

  @Get('interviews')
  @Roles('PEOPLE', 'INTERVIEWER')
  async list(@CurrentUser() user: AuthUser) {
    const allowed = await allowedPositions(user);
    const rows = await q(`SELECT i.*, a.name applicant_name, a.position_id, p.name position_name FROM interviews i JOIN applicants a ON a.id=i.applicant_id JOIN positions p ON p.id=a.position_id WHERE i.start_at > now() - interval '7 days' ORDER BY i.start_at`);
    return rows.filter((r) => !allowed || (allowed.includes(r.position_id) && (r.interviewer_ids || []).includes(user.id)));
  }

  // ---------- 통계 (B19) ----------
  @Get('stats')
  @Roles('PEOPLE')
  async stats(@Query('positionId') positionId?: string) {
    const positions = await q(`SELECT * FROM positions ORDER BY id`);
    const pos = positions.find((p) => p.id === positionId) || positions[0];
    const apps = await q(`SELECT * FROM applicants WHERE position_id=$1`, [pos.id]);
    const flow = flowFor(pos.has_task);
    const idx = (s: string | null) => (s ? flow.indexOf(s) : -1);
    const reached = (a: any) => {
      if (!a.stage) return -1;
      if (a.stage === '불합격' || a.stage === '중도 이탈') return idx(a.end_stage);
      return idx(a.stage);
    };
    const known = apps.filter((a) => reached(a) >= 0);
    const funnel = flow.map((s, i) => {
      const n = known.filter((a) => reached(a) >= i).length;
      const prev = i === 0 ? known.length : known.filter((a) => reached(a) >= i - 1).length;
      const passed = i === flow.length - 1 ? null : known.filter((a) => reached(a) >= i + 1).length;
      return { stage: s, reached: n, passed };
    }).map((f, i, arr) => ({
      ...f,
      fromPrevRate: i === 0 ? 100 : arr[i - 1].reached ? Math.round((f.reached / arr[i - 1].reached) * 1000) / 10 : 0,
      fromTotalRate: known.length ? Math.round((f.reached / known.length) * 1000) / 10 : 0,
      rejectedHere: known.filter((a) => a.stage === '불합격' && a.end_stage === f.stage).length,
      droppedHere: known.filter((a) => a.stage === '중도 이탈' && a.end_stage === f.stage).length,
      inProgress: known.filter((a) => a.stage === f.stage).length,
    }));
    const firstInterview = flow.indexOf('1차 면접');
    const sources = [...new Set(apps.map((a) => a.source || '(누락)'))].map((src) => {
      const g = apps.filter((a) => (a.source || '(누락)') === src);
      const gk = g.filter((a) => reached(a) >= 0);
      const decided = gk.filter((a) => reached(a) >= 1 || (a.stage === '불합격' && a.end_stage === '서류') || (a.stage === '중도 이탈' && a.end_stage === '서류'));
      const passedDoc = gk.filter((a) => reached(a) >= 1).length;
      return {
        source: src, applicants: g.length,
        docPassRate: decided.length ? Math.round((passedDoc / decided.length) * 1000) / 10 : null,
        interviews: gk.filter((a) => reached(a) >= firstInterview).length,
        hires: gk.filter((a) => a.stage === '입사').length,
      };
    }).sort((x, y) => y.applicants - x.applicants);
    return {
      positions: positions.map((p) => ({ id: p.id, name: p.name })), position: pos, total: apps.length,
      missingStage: apps.length - known.length,
      rejected: apps.filter((a) => a.stage === '불합격').length, dropped: apps.filter((a) => a.stage === '중도 이탈').length,
      funnel, sources,
      formula: '앞 단계 대비 = 이 단계에 도달한 수 ÷ 바로 앞 단계에 도달한 수 · 전체 대비 = 이 단계에 도달한 수 ÷ 단계가 확인된 전체 지원자 · 불합격·중도 이탈은 종료된 단계까지 도달한 것으로 계산 · 단계 누락은 분모에서 제외',
    };
  }
}
