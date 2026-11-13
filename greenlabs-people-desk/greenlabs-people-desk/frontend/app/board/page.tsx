'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

const FILTERS: [string, string, (c: any) => boolean, string][] = [
  ['noticeOverdue', '안내 기한 초과', (c) => c.badges.some((b: any) => b.type === 'notice_overdue'), 'red'],
  ['noticeSoon', '안내 기한 임박', (c) => c.badges.some((b: any) => b.type === 'notice_soon'), 'org'],
  ['scheduleNeeded', '일정 확정 필요', (c) => c.nextAction === '면접 일정 확정', ''],
  ['evalPending', '평가 제출 대기', (c) => c.nextAction === '평가 제출', ''],
  ['decide', '단계 결정 필요', (c) => c.nextAction === '단계 결정', ''],
  ['taskOverdue', '과제 기한 초과', (c) => c.badges.some((b: any) => b.type === 'task_overdue'), 'red'],
  ['review', '확인 필요', (c) => c.badges.some((b: any) => b.type === 'review'), ''],
];

export default function Board() {
  const [data, setData] = useState<any>(null);
  const [pid, setPid] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const me = typeof window !== 'undefined' ? getMe() : null;
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('positionId') || '';
    setPid(p);
  }, []);
  useEffect(() => {
    api('/board' + (pid ? `?positionId=${pid}` : '')).then(setData).catch((e) => setErr(e.message));
  }, [pid]);
  const f = FILTERS.find((x) => x[0] === filter);
  const visible = (data?.cards || []).filter((c: any) => (!f || f[2](c)) && (!q || c.name.includes(q) || c.id.includes(q.toUpperCase())));
  const colOf = (c: any) => c.stage || '단계 누락';
  return (
    <Shell roles={['PEOPLE', 'INTERVIEWER']}>
      <h1>채용 보드</h1>
      <p className="desc">지원자가 어느 단계에 있고, 다음에 누가 무엇을 해야 하는지 한눈에 봅니다.{me?.role === 'INTERVIEWER' && ' 면접관은 담당 포지션만 볼 수 있습니다.'}</p>
      {err && <div className="err">{err}</div>}
      {data && (
        <>
          <div className="tabs">
            {data.positions.map((p: any) => (
              <button key={p.id} className={data.position.id === p.id ? 'on' : ''} onClick={() => { setPid(p.id); history.replaceState(null, '', `?positionId=${p.id}`); }}>{p.id} {p.name}</button>
            ))}
          </div>
          <div className="chips">
            <span className="small" style={{ alignSelf: 'center' }}>오늘 할 일 (담당 전체 포지션)</span>
            {FILTERS.filter(([k]) => me?.role === 'PEOPLE' || ['scheduleNeeded', 'evalPending'].includes(k)).map(([k, label, , cls]) => (
              <button key={k} className={`chip ${cls} ${filter === k ? 'on' : ''}`} style={filter === k ? { borderColor: 'var(--g)', background: '#e8f1ec' } : {}} onClick={() => setFilter(filter === k ? '' : k)}>
                {label}<b>{data.summary[k]}</b>
              </button>
            ))}
            <input placeholder="이름·지원자ID 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: 'auto' }} />
          </div>
          {filter && <p className="small">필터: {f?.[1]} — 현재 포지션({data.position.name})에서 {visible.length}명</p>}
          <div className="board">
            {data.columns.map((col: string) => {
              const list = visible.filter((c: any) => colOf(c) === col).sort((a: any, b: any) => b.badges.filter((x: any) => x.level !== 'blue').length - a.badges.filter((x: any) => x.level !== 'blue').length);
              if (col === '단계 누락' && list.length === 0) return null;
              const isEnd = ['불합격', '중도 이탈'].includes(col);
              return (
                <div key={col} className={`col ${isEnd ? 'end' : ''}`}>
                  <h3><span>{col}</span><span>{list.length}</span></h3>
                  {list.slice(0, isEnd && !filter && !q ? 15 : 200).map((c: any) => (
                    <a key={c.id} className="acard" href={`/applicants/${c.id}`}>
                      <div className="n">{c.name} <span className="m">{c.id}</span></div>
                      <div className="m">{c.source || '지원 경로 없음'} · 지원 {c.appliedAt}{c.endReason ? ` · ${c.endReason}` : ''}</div>
                      {c.nextAction && c.nextAction !== '종료' && <div className="next">▶ {c.nextAction} · <b>{c.nextOwner}</b></div>}
                      {c.badges.map((b: any, i: number) => <span key={i} className={`badge ${b.level}`}>{b.label}</span>)}
                    </a>
                  ))}
                  {isEnd && !filter && !q && list.length > 15 && <div className="small" style={{ padding: 4 }}>외 {list.length - 15}명 (검색으로 찾기)</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
