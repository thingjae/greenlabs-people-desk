import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { q, one } from './db';
import { AuthUser, CurrentUser, Roles, allowedPositions, assertApplicantAccess } from './auth';
import { FLOW, END, DROP_REASONS, flowFor, today, toDate, addBizDays, bizDaysBetween, ymd, digits, normalizePhone, SOURCES } from './util';

export async function setting(key: string, def: number) {
  const r = await one(`SELECT value FROM settings WHERE key=$1`, [key]);
  return r ? Number(r.value) : def;
}

/** 보드 카드 계산: 다음 할 일·담당자·배지 (B2·B4·B5·B11) */
export async function buildCards(apps: any[], user: AuthUser) {
  if (apps.length === 0) return [];
  const ids = apps.map((a) => a.id);
  const posIds = [...new Set(apps.map((a) => a.position_id))];
  const [assign, interviews, evals, dupRows] = await Promise.all([
    q(`SELECT pi.position_id, pi.stage, u.id, u.name FROM position_interviewers pi JOIN users u ON u.id=pi.user_id WHERE pi.position_id = ANY($1)`, [posIds]),
    q(`SELECT * FROM interviews WHERE applicant_id = ANY($1)`, [ids]),
    q(`SELECT applicant_id, interviewer_id, stage, submitted_at FROM evaluations WHERE applicant_id = ANY($1)`, [ids]),
    user.role === 'PEOPLE'
      ? q(`SELECT a.id, a.email, a.name, a.phone FROM applicants a`)
      : Promise.resolve([] as any[]),
  ]);
  const noticeDays = await setting('result_notice_bizdays', 5);
  const evalDays = await setting('eval_due_bizdays', 2);
  const t = today();
  const byEmail = new Map<string, string[]>();
  const byNamePhone = new Map<string, any[]>();
  for (const d of dupRows) {
    const e = d.email.toLowerCase();
    byEmail.set(e, [...(byEmail.get(e) || []), d.id]);
    const k = d.name + '|' + digits(d.phone);
    byNamePhone.set(k, [...(byNamePhone.get(k) || []), d]);
  }
  const stageKey = (s: string) => (s === '1차 면접' ? 'FIRST' : s === '2차 면접' ? 'SECOND' : null);
  const names = (pid: string, st: string) => assign.filter((a) => a.position_id === pid && a.stage === st);

  return apps.map((a) => {
    const badges: { type: string; label: string; level: 'red' | 'orange' | 'yellow' | 'blue' }[] = [];
    let nextAction = '';
    let nextOwner = '';
    const sk = stageKey(a.stage);
    const iv = interviews.filter((i) => i.applicant_id === a.id && i.stage === a.stage).sort((x, y) => +new Date(y.start_at) - +new Date(x.start_at))[0];
    if (!a.stage) { nextAction = '현재 단계 확인'; nextOwner = '피플팀'; }
    else if (a.stage === '서류') { nextAction = '서류 검토'; nextOwner = '피플팀'; }
    else if (a.stage === '과제') {
      if (a.task_submitted_at) { nextAction = '과제 검토'; nextOwner = names(a.position_id, 'FIRST').map((x) => x.name).join(', ') || '1차 면접관'; }
      else { nextAction = '과제 제출 대기'; nextOwner = '지원자'; }
      const due = toDate(a.task_due_at);
      if (due && due < t && !a.task_submitted_at) badges.push({ type: 'task_overdue', label: '과제 기한 초과', level: 'red' });
    } else if (sk) {
      const assigned = names(a.position_id, sk);
      if (!iv) { nextAction = '면접 일정 확정'; nextOwner = '피플팀'; }
      else {
        const pending = assigned.filter((p) => !evals.find((e) => e.applicant_id === a.id && e.interviewer_id === p.id && e.stage === a.stage && e.submitted_at));
        if (new Date(iv.start_at) > new Date()) { nextAction = `면접 예정 ${ymd(new Date(iv.start_at))}`; nextOwner = assigned.map((x) => x.name).join(', '); }
        else if (pending.length) {
          nextAction = '평가 제출'; nextOwner = pending.map((x) => x.name).join(', ');
          const due = addBizDays(toDate(iv.start_at)!, evalDays);
          if (due < t) badges.push({ type: 'eval_overdue', label: '평가 미제출', level: 'orange' });
        } else { nextAction = '단계 결정'; nextOwner = '피플팀'; }
      }
    } else if (a.stage === '처우 협의') { nextAction = '처우 협의'; nextOwner = '피플팀'; }
    else if (a.stage === '입사') { nextAction = '입사 준비'; nextOwner = '피플팀'; }
    else if (a.stage === '불합격') {
      if (!a.result_notified_at) {
        nextAction = '불합격 안내'; nextOwner = '피플팀';
        const base = toDate(a.stage_changed_at) || t;
        const due = addBizDays(base, noticeDays);
        const left = bizDaysBetween(t, due);
        if (left < 0) badges.push({ type: 'notice_overdue', label: `안내 기한 초과 (${-left}영업일)`, level: 'red' });
        else if (left <= 1) badges.push({ type: 'notice_soon', label: `안내 기한 D-${left}`, level: 'orange' });
      } else { nextAction = '종료'; nextOwner = '-'; }
    } else if (a.stage === '중도 이탈') { nextAction = '종료'; nextOwner = '-'; }

    if (user.role === 'PEOPLE') {
      const same = (byEmail.get(a.email.toLowerCase()) || []).filter((x) => x !== a.id);
      if (same.length) badges.push({ type: 'duplicate', label: '중복 지원', level: 'blue' });
      const sus = (byNamePhone.get(a.name + '|' + digits(a.phone)) || []).filter((x) => x.id !== a.id && x.email.toLowerCase() !== a.email.toLowerCase());
      if (sus.length) badges.push({ type: 'suspect', label: '중복 의심', level: 'blue' });
      if (a.needs_review) badges.push({ type: 'review', label: '확인 필요', level: 'yellow' });
    }
    return {
      id: a.id, positionId: a.position_id, name: a.name, source: a.source, stage: a.stage, status: a.status,
      endStage: a.end_stage, endReason: a.end_reason, appliedAt: ymd(toDate(a.applied_at)), stageChangedAt: ymd(toDate(a.stage_changed_at)),
      nextAction, nextOwner, badges,
    };
  });
}

function sanitize(a: any, user: AuthUser) {
  const out: any = {
    id: a.id, positionId: a.position_id, name: a.name, email: a.email, phone: a.phone, source: a.source,
    appliedAt: ymd(toDate(a.applied_at)), stage: a.stage, status: a.status, endStage: a.end_stage, endReason: a.end_reason,
    stageChangedAt: ymd(toDate(a.stage_changed_at)), taskDueAt: ymd(toDate(a.task_due_at)), taskSubmittedAt: ymd(toDate(a.task_submitted_at)),
    resultNotifiedAt: ymd(toDate(a.result_notified_at)), needsReview: a.needs_review,
  };
  if (user.role === 'PEOPLE') { out.salaryOffer = a.salary_offer; out.reviewNote = a.review_note; }
  return out;
}

@Controller()
export class ApplicantsController {
  @Get('positions')
  async positions(@CurrentUser() user: AuthUser) {
    const allowed = await allowedPositions(user);
    if (allowed && allowed.length === 0 && user.role === 'EMPLOYEE') return [];
    const rows = await q(`SELECT p.*, (SELECT count(*)::int FROM applicants a WHERE a.position_id=p.id) cnt FROM positions p ORDER BY id`);
    return rows.filter((p) => !allowed || allowed.includes(p.id));
  }

  @Get('board')
  @Roles('PEOPLE', 'INTERVIEWER')
  async board(@CurrentUser() user: AuthUser, @Query('positionId') positionId?: string) {
    const allowed = await allowedPositions(user);
    const pos = await q(`SELECT * FROM positions ORDER BY id`);
    const visible = pos.filter((p) => !allowed || allowed.includes(p.id));
    const pid = positionId && visible.find((p) => p.id === positionId) ? positionId : visible[0]?.id;
    if (positionId && !visible.find((p) => p.id === positionId)) throw new ForbiddenException('담당 포지션만 볼 수 있습니다');
    const position = visible.find((p) => p.id === pid);
    const apps = await q(`SELECT * FROM applicants WHERE position_id=$1 ORDER BY applied_at DESC, id`, [pid]);
    const cards = await buildCards(apps, user);
    // 오늘 할 일 요약 (볼 수 있는 모든 포지션 기준)
    const allApps = await q(`SELECT * FROM applicants WHERE position_id = ANY($1)`, [visible.map((p) => p.id)]);
    const allCards = await buildCards(allApps, user);
    const count = (f: (c: any) => boolean) => allCards.filter(f).length;
    const summary = {
      noticeOverdue: count((c) => c.badges.some((b) => b.type === 'notice_overdue')),
      noticeSoon: count((c) => c.badges.some((b) => b.type === 'notice_soon')),
      scheduleNeeded: count((c) => c.nextAction === '면접 일정 확정'),
      evalPending: count((c) => c.nextAction === '평가 제출'),
      taskOverdue: count((c) => c.badges.some((b) => b.type === 'task_overdue')),
      review: count((c) => c.badges.some((b) => b.type === 'review')),
      decide: count((c) => c.nextAction === '단계 결정'),
    };
    const flow = flowFor(position.has_task);
    return { positions: visible.map((p) => ({ id: p.id, name: p.name })), position, columns: [...flow, ...END, '단계 누락'], cards, summary };
  }

  @Get('applicants/:id')
  @Roles('PEOPLE', 'INTERVIEWER')
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const a = await assertApplicantAccess(user, id);
    const position = await one(`SELECT * FROM positions WHERE id=$1`, [a.position_id]);
    const [card] = await buildCards([a], user);
    const histories = await q(`SELECT h.*, u.name changed_by_name FROM stage_histories h LEFT JOIN users u ON u.id=h.changed_by WHERE applicant_id=$1 ORDER BY changed_at`, [id]);
    const interviews = await q(`SELECT * FROM interviews WHERE applicant_id=$1 ORDER BY start_at`, [id]);
    const res: any = { applicant: sanitize(a, user), position, card, interviews, flow: flowFor(position.has_task) };
    res.histories = histories.map((h) => ({ ...h, reason: user.role === 'PEOPLE' ? h.reason : undefined }));
    if (user.role === 'PEOPLE') {
      res.emails = await q(`SELECT * FROM email_logs WHERE applicant_id=$1 ORDER BY created_at DESC`, [id]);
      // B11·B13: 같은 이메일 지원 기록과 중복 의심 (피플팀만)
      res.sameEmail = await q(`SELECT a.id, a.position_id, p.name position_name, a.stage, a.applied_at, a.end_reason FROM applicants a JOIN positions p ON p.id=a.position_id WHERE lower(a.email)=lower($1) AND a.id<>$2`, [a.email, id]);
      const sus = await q(`SELECT a.id, a.position_id, a.email, a.stage, a.applied_at, a.phone FROM applicants a WHERE a.name=$1 AND a.id<>$2 AND lower(a.email)<>lower($3)`, [a.name, id, a.email]);
      res.suspects = sus.filter((s) => digits(s.phone) === digits(a.phone));
    }
    return res;
  }

  /** 단계 이동·불합격·중도 이탈 (B3, 피플팀만) */
  @Post('applicants/:id/transition')
  @Roles('PEOPLE')
  async transition(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: { to: string; reason?: string }) {
    const a = await one(`SELECT a.*, p.has_task FROM applicants a JOIN positions p ON p.id=a.position_id WHERE a.id=$1`, [id]);
    if (!a) throw new BadRequestException('지원자를 찾을 수 없습니다');
    if (!a.stage) throw new BadRequestException('현재 단계가 비어 있습니다. 먼저 현재 단계를 확인해 입력해 주세요');
    if (END.includes(a.stage) || a.stage === '입사') throw new BadRequestException('이미 종료된 지원자입니다');
    const flow = flowFor(a.has_task);
    const t = ymd(today());
    if (b.to === '다음 단계') {
      const next = flow[flow.indexOf(a.stage) + 1];
      if (!next) throw new BadRequestException('다음 단계가 없습니다');
      await q(`UPDATE applicants SET stage=$1, status=$2, stage_changed_at=$3 WHERE id=$4`, [next, next === '입사' ? '입사 확정' : '진행 중', t, id]);
      if (next === '과제') await q(`UPDATE applicants SET task_due_at=$1, task_submitted_at=null WHERE id=$2`, [ymd(addBizDays(today(), 5)), id]);
      await q(`INSERT INTO stage_histories(applicant_id,from_stage,to_stage,changed_by,reason) VALUES($1,$2,$3,$4,$5)`, [id, a.stage, next, user.id, b.reason || null]);
      return { ok: true, stage: next };
    }
    if (b.to === '불합격' || b.to === '중도 이탈') {
      if (b.to === '중도 이탈' && !DROP_REASONS.includes(b.reason || '')) throw new BadRequestException(`중도 이탈 사유를 골라 주세요 (${DROP_REASONS.join(', ')})`);
      await q(`UPDATE applicants SET stage=$1, status=$1, end_stage=$2, end_reason=$3, stage_changed_at=$4 WHERE id=$5`, [b.to, a.stage, b.reason || null, t, id]);
      await q(`INSERT INTO stage_histories(applicant_id,from_stage,to_stage,changed_by,reason) VALUES($1,$2,$3,$4,$5)`, [id, a.stage, b.to, user.id, b.reason || null]);
      return { ok: true, stage: b.to };
    }
    throw new BadRequestException('알 수 없는 단계 변경입니다');
  }

  /** 확인 필요 해소, 연봉 입력, 과제 제출 기록 (피플팀만) */
  @Patch('applicants/:id')
  @Roles('PEOPLE')
  async patch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: any) {
    const a = await one(`SELECT * FROM applicants WHERE id=$1`, [id]);
    if (!a) throw new BadRequestException('지원자를 찾을 수 없습니다');
    if (b.stage !== undefined) {
      if (![...FLOW, ...END].includes(b.stage)) throw new BadRequestException('단계 값이 올바르지 않습니다');
      await q(`UPDATE applicants SET stage=$1, status=$2, stage_changed_at=COALESCE(stage_changed_at,$3) WHERE id=$4`, [b.stage, END.includes(b.stage) ? b.stage : b.stage === '입사' ? '입사 확정' : '진행 중', ymd(today()), id]);
      await q(`INSERT INTO stage_histories(applicant_id,from_stage,to_stage,changed_by,reason) VALUES($1,$2,$3,$4,'누락 단계 확인 입력')`, [id, a.stage, b.stage, user.id]);
    }
    if (b.source !== undefined) {
      if (!SOURCES.includes(b.source)) throw new BadRequestException('지원 경로 값이 올바르지 않습니다');
      await q(`UPDATE applicants SET source=$1 WHERE id=$2`, [b.source, id]);
    }
    if (b.salaryOffer !== undefined) await q(`UPDATE applicants SET salary_offer=$1 WHERE id=$2`, [b.salaryOffer, id]);
    if (b.taskSubmitted) await q(`UPDATE applicants SET task_submitted_at=$1 WHERE id=$2`, [ymd(today()), id]);
    if (b.phone !== undefined) await q(`UPDATE applicants SET phone=$1 WHERE id=$2`, [normalizePhone(b.phone), id]);
    const u = await one(`SELECT * FROM applicants WHERE id=$1`, [id]);
    const stillNeeds = !u.stage || !u.source;
    await q(`UPDATE applicants SET needs_review=$1 WHERE id=$2`, [stillNeeds, id]);
    return { ok: true };
  }
}
