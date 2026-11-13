'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

function days() {
  const out: Date[] = [];
  const d = new Date();
  for (let i = 1; out.length < 10; i++) { const x = new Date(d.getTime() + i * 86400e3); const w = new Date(x.getTime() + 9 * 3600e3).getUTCDay(); if (w !== 0 && w !== 6) out.push(x); }
  return out;
}
const slotIso = (day: Date, hour: number) => { const k = new Date(day.getTime() + 9 * 3600e3); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), hour - 9)).toISOString(); };

export default function Schedule() {
  const me = typeof window !== 'undefined' ? getMe() : null;
  const [avail, setAvail] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [appId, setAppId] = useState('');
  const [stage, setStage] = useState('1차 면접');
  const [slots, setSlots] = useState<any>(null);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const load = async () => {
    if (me?.role === 'INTERVIEWER') setAvail(await api('/availabilities'));
    setInterviews(await api('/interviews'));
  };
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('applicantId')) { setAppId(p.get('applicantId')!); setStage(p.get('stage') || '1차 면접'); findSlots(p.get('applicantId')!, p.get('stage') || '1차 면접'); }
    load().catch((e) => setMsg({ t: 'err', m: e.message }));
  }, []);
  const toggle = async (iso: string) => {
    const ex = avail.find((a) => new Date(a.start_at).toISOString() === iso);
    try {
      if (ex) await api(`/availabilities/${ex.id}`, { method: 'DELETE' });
      else await api('/availabilities', { body: { startAt: iso, endAt: new Date(new Date(iso).getTime() + 3600e3).toISOString() } });
      setAvail(await api('/availabilities'));
    } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  const findSlots = async (id = appId, st = stage) => {
    setMsg(null);
    try { setSlots(await api(`/interviews/slots?applicantId=${id}&stage=${encodeURIComponent(st)}`)); } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  const confirmSlot = async (startAt: string) => {
    setMsg(null);
    try { await api('/interviews', { body: { applicantId: appId, stage, startAt } }); setMsg({ t: 'ok', m: `${fmt(startAt)}로 확정했습니다. 면접 일정 메일 초안이 만들어졌습니다 (지원자 상세 > 메일).` }); findSlots(); load(); }
    catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  return (
    <Shell roles={['PEOPLE', 'INTERVIEWER']}>
      <h1>면접 일정</h1>
      <p className="desc">{me?.role === 'INTERVIEWER' ? '면접 가능한 시간을 눌러 저장하세요. 피플팀이 이 시간 중에서 일정을 확정합니다.' : '배정된 면접관 모두가 가능한 시간 중에서 일정을 확정합니다. 메일을 주고받지 않아도 됩니다.'}</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      {me?.role === 'INTERVIEWER' && (
        <div className="card">
          <h3>내 가능 시간 (1시간 단위, 다음 2주 평일)</h3>
          <table><thead><tr><th></th>{[9, 10, 11, 13, 14, 15, 16, 17].map((h) => <th key={h}>{h}:00</th>)}</tr></thead><tbody>
            {days().map((d) => (
              <tr key={d.toISOString()}><td>{new Date(d.getTime()).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' })}</td>
                {[9, 10, 11, 13, 14, 15, 16, 17].map((h) => { const iso = slotIso(d, h); const on = avail.some((a) => new Date(a.start_at).toISOString() === iso); return <td key={h}><span className={`slot ${on ? 'on' : ''}`} onClick={() => toggle(iso)}>{on ? '가능' : '-'}</span></td>; })}
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
      {me?.role === 'PEOPLE' && (
        <div className="card">
          <h3>일정 확정</h3>
          <div className="row">
            <input placeholder="지원자 ID (예: A0123)" value={appId} onChange={(e) => setAppId(e.target.value.toUpperCase())} />
            <select value={stage} onChange={(e) => setStage(e.target.value)}><option>1차 면접</option><option>2차 면접</option></select>
            <button className="primary" onClick={() => findSlots()}>가능한 시간 찾기</button>
          </div>
          {slots && (
            <div style={{ marginTop: 10 }}>
              <p className="small">배정 면접관: {slots.interviewers.map((i: any) => i.name).join(', ') || '없음'} · 면접 {slots.minutes}분 · 모두 가능한 시간 {slots.slots.length}개</p>
              {slots.slots.length === 0 && <div className="note">모든 면접관이 가능한 시간이 없습니다. 면접관에게 가능 시간 입력을 요청하세요.</div>}
              {slots.slots.map((s: any) => <span key={s.startAt} className="slot" onClick={() => confirmSlot(s.startAt)}>{fmt(s.startAt)} 확정</span>)}
            </div>
          )}
        </div>
      )}
      <div className="card">
        <h3>예정된 면접</h3>
        <table><thead><tr><th>일시</th><th>지원자</th><th>포지션</th><th>단계</th></tr></thead><tbody>
          {interviews.map((i) => <tr key={i.id}><td>{fmt(i.start_at)}</td><td><a href={`/applicants/${i.applicant_id}`}>{i.applicant_name} ({i.applicant_id})</a></td><td>{i.position_name}</td><td>{i.stage}</td></tr>)}
        </tbody></table>
        {interviews.length === 0 && <p className="small">예정된 면접이 없습니다.</p>}
      </div>
    </Shell>
  );
}
