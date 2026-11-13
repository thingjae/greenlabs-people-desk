'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

const SOURCES = ['사람인', '원티드', '잡코리아', '리멤버', '로켓펀치', '사내 추천', '회사 채용 페이지'];
const STAGES = ['서류', '과제', '1차 면접', '2차 면접', '처우 협의', '입사', '불합격', '중도 이탈'];
const DROP = ['지원 취소', '처우 결렬', '입사 포기', '과제 미제출'];
const TYPES = ['접수', '과제', '면접 일정', '합격', '불합격'];

export default function Detail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [d, setD] = useState<any>(null);
  const [evals, setEvals] = useState<any[]>([]);
  const [crit, setCrit] = useState<Record<string, any[]>>({});
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [drop, setDrop] = useState('');
  const [fix, setFix] = useState<{ stage?: string; source?: string }>({});
  const [salary, setSalary] = useState('');
  const me = typeof window !== 'undefined' ? getMe() : null;
  const people = me?.role === 'PEOPLE';
  const load = async () => {
    try {
      const r = await api(`/applicants/${id}`);
      setD(r); setSalary(r.applicant.salaryOffer || '');
      const ev = await api(`/applicants/${id}/evaluations`); setEvals(ev);
      const c: Record<string, any[]> = {};
      for (const st of ['1차 면접', '2차 면접']) c[st] = await api(`/applicants/${id}/criteria?stage=${encodeURIComponent(st)}`);
      setCrit(c);
    } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  useEffect(() => { load(); }, [id]);
  const act = async (fn: () => Promise<any>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ t: 'ok', m: ok }); await load(); } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  if (!d) return <Shell roles={['PEOPLE', 'INTERVIEWER']}>{msg && <div className="err">{msg.m}</div>}</Shell>;
  const a = d.applicant;
  const ended = ['불합격', '중도 이탈', '입사'].includes(a.stage);
  const nextStage = a.stage && d.flow[d.flow.indexOf(a.stage) + 1];
  const isInterview = ['1차 면접', '2차 면접'].includes(a.stage);
  const critName = (stage: string, cid: string) => (crit[stage] || []).find((c) => String(c.id) === String(cid))?.item || cid;
  return (
    <Shell roles={['PEOPLE', 'INTERVIEWER']}>
      <p className="small"><a href={`/board?positionId=${a.positionId}`}>← {d.position.id} {d.position.name} 보드</a></p>
      <h1>{a.name} <span className="small">{a.id}</span></h1>
      <p className="desc">{d.position.name} · 현재 단계 <b>{a.stage || '누락'}</b>{a.endStage ? ` (${a.endStage}에서 종료${a.endReason ? ' · ' + a.endReason : ''})` : ''}</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      <div className="card">
        <b>다음 할 일:</b> {d.card.nextAction} · <b>{d.card.nextOwner}</b>
        <div>{d.card.badges.map((b: any, i: number) => <span key={i} className={`badge ${b.level}`}>{b.label}</span>)}</div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>기본 정보</h3>
          <div className="kv">
            <div>이메일</div><div>{a.email}</div><div>연락처</div><div>{a.phone}</div>
            <div>지원 경로</div><div>{a.source || <span className="badge yellow">누락</span>}</div><div>지원일</div><div>{a.appliedAt}</div>
            <div>단계 변경일</div><div>{a.stageChangedAt || '-'}</div>
            {a.taskDueAt && <><div>과제 마감일</div><div>{a.taskDueAt} · 제출 {a.taskSubmittedAt || '안 함'}</div></>}
            <div>결과 안내일</div><div>{a.resultNotifiedAt || '-'}</div>
            {people && <><div>메모</div><div>{a.reviewNote || '-'}</div></>}
          </div>
          {people && a.needsReview && (
            <div className="note" style={{ marginTop: 10 }}>
              <b>확인 필요</b> — 비어 있는 값을 확인해 입력하세요.
              <div className="row" style={{ marginTop: 6 }}>
                {!a.stage && <select value={fix.stage || ''} onChange={(e) => setFix({ ...fix, stage: e.target.value })}><option value="">현재 단계</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>}
                {!a.source && <select value={fix.source || ''} onChange={(e) => setFix({ ...fix, source: e.target.value })}><option value="">지원 경로</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>}
                <button onClick={() => act(() => api(`/applicants/${id}`, { method: 'PATCH', body: fix }), '저장했습니다')}>저장</button>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          {people ? (
            <>
              <h3>단계 결정 (피플팀)</h3>
              {!a.stage ? <p className="small">현재 단계를 먼저 확인해 입력하세요.</p> : ended ? <p className="small">종료된 지원자입니다.</p> : (
                <>
                  <div className="row">
                    {nextStage && <button className="primary" onClick={() => act(() => api(`/applicants/${id}/transition`, { body: { to: '다음 단계' } }), `${nextStage} 단계로 옮겼습니다`)}>{nextStage}(으)로 이동</button>}
                    <button className="danger" onClick={() => confirm('불합격으로 확정할까요? 5영업일 안에 안내해야 합니다.') && act(() => api(`/applicants/${id}/transition`, { body: { to: '불합격' } }), '불합격으로 확정했습니다. 안내 메일 초안을 만들어 보내세요.')}>불합격</button>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <select value={drop} onChange={(e) => setDrop(e.target.value)}><option value="">중도 이탈 사유</option>{DROP.map((s) => <option key={s}>{s}</option>)}</select>
                    <button onClick={() => act(() => api(`/applicants/${id}/transition`, { body: { to: '중도 이탈', reason: drop } }), '중도 이탈로 기록했습니다')}>중도 이탈</button>
                  </div>
                  {a.stage === '과제' && !a.taskSubmittedAt && <button style={{ marginTop: 8 }} onClick={() => act(() => api(`/applicants/${id}`, { method: 'PATCH', body: { taskSubmitted: true } }), '과제 제출을 기록했습니다')}>과제 제출 기록</button>}
                  {isInterview && <div style={{ marginTop: 8 }}><a href={`/schedule?applicantId=${a.id}&stage=${encodeURIComponent(a.stage)}`}><button>면접 일정 잡기</button></a></div>}
                </>
              )}
              <h3 style={{ marginTop: 16 }}>처우 정보 (피플팀만 열람)</h3>
              <div className="row"><input style={{ flex: 1 }} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="희망·제시 연봉" />
                <button onClick={() => act(() => api(`/applicants/${id}`, { method: 'PATCH', body: { salaryOffer: salary } }), '저장했습니다')}>저장</button></div>
            </>
          ) : (
            <>
              <h3>면접관 메뉴</h3>
              {isInterview ? <a href={`/applicants/${id}/evaluate?stage=${encodeURIComponent(a.stage)}`}><button className="primary">{a.stage} 평가 작성</button></a> : <p className="small">면접 단계가 아니라 평가할 수 없습니다.</p>}
              <p className="small" style={{ marginTop: 10 }}>연봉, 이전 지원 기록, 단계 결정은 피플팀만 볼 수 있습니다.</p>
            </>
          )}
        </div>
      </div>

      {people && (d.sameEmail?.length > 0 || d.suspects?.length > 0) && (
        <div className="card">
          <h3>이전·중복 지원 기록 (피플팀만)</h3>
          <table><thead><tr><th>구분</th><th>지원자</th><th>포지션</th><th>단계</th><th>지원일</th></tr></thead><tbody>
            {d.sameEmail.map((x: any) => <tr key={x.id}><td><span className="badge blue">같은 이메일</span></td><td><a href={`/applicants/${x.id}`}>{x.id}</a></td><td>{x.position_name}</td><td>{x.stage}{x.end_reason ? ` · ${x.end_reason}` : ''}</td><td>{String(x.applied_at).slice(0, 10)}</td></tr>)}
            {d.suspects.map((x: any) => <tr key={x.id}><td><span className="badge blue">중복 의심 (이름·연락처 같음, 이메일 다름)</span></td><td><a href={`/applicants/${x.id}`}>{x.id}</a></td><td>{x.position_id}</td><td>{x.stage}</td><td>{String(x.applied_at).slice(0, 10)}</td></tr>)}
          </tbody></table>
          <p className="small">중복 의심은 같은 사람으로 자동 합치지 않습니다. 피플팀이 확인하세요.</p>
        </div>
      )}

      <div className="card">
        <h3>면접 평가</h3>
        {evals.length === 0 && <p className="small">아직 평가가 없습니다.</p>}
        {evals.map((e) => (
          <div key={e.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
            <b>{e.stage} · {e.interviewerName}</b>{' '}
            {e.hidden ? <span className="lock">🔒 본인 평가를 제출하면 공개됩니다 {e.submitted ? '(제출됨)' : ''}</span> : (
              <>
                <span className="badge blue">{e.verdict}</span>{e.score100 !== null && <span className="small"> 환산 {e.score100}점</span>}
                <table style={{ marginTop: 4 }}><tbody>{Object.entries(e.scores || {}).map(([cid, v]: any) => <tr key={cid}><td style={{ width: 180 }}>{critName(e.stage, cid)}</td><td style={{ width: 50 }}><b>{v.score}</b></td><td>{v.note}</td></tr>)}</tbody></table>
              </>
            )}
          </div>
        ))}
      </div>

      {d.interviews.length > 0 && (
        <div className="card"><h3>면접 일정</h3>
          {d.interviews.map((i: any) => <div key={i.id}>{i.stage} · {new Date(i.start_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>)}
        </div>
      )}

      {people && (
        <div className="card">
          <h3>메일</h3>
          <div className="row">{TYPES.map((t) => <button key={t} onClick={() => act(() => api('/emails/draft', { body: { applicantId: id, type: t } }), `${t} 메일 초안을 만들었습니다`)}>{t} 초안</button>)}</div>
          <table style={{ marginTop: 8 }}><tbody>
            {d.emails.map((e: any) => (
              <tr key={e.id}><td style={{ width: 90 }}>{e.type}</td><td><b>{e.subject}</b><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{e.body}</div></td>
                <td style={{ width: 150 }}>{e.status === '발송 완료' ? <span className="badge blue">발송 완료 {String(e.sent_at).slice(0, 10)}</span> : <button className="primary" onClick={() => act(() => api(`/emails/${e.id}/sent`, { body: {} }), '발송 완료로 기록했습니다')}>발송 완료 처리</button>}</td></tr>
            ))}
          </tbody></table>
          <p className="small">시연 환경에서는 실제로 메일을 보내지 않고 발송 기록만 남깁니다.</p>
        </div>
      )}

      <div className="card">
        <h3>단계 이력</h3>
        <table><tbody>{d.histories.map((h: any) => <tr key={h.id}><td>{new Date(h.changed_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td><td>{h.from_stage || '-'} → <b>{h.to_stage}</b></td><td>{h.changed_by_name}</td><td>{h.reason || ''}</td></tr>)}</tbody></table>
        {d.histories.length === 0 && <p className="small">기존 엑셀에서 가져온 지원자는 이전 이력이 없습니다.</p>}
      </div>
    </Shell>
  );
}
