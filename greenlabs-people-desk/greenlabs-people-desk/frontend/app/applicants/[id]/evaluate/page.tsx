'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

export default function Evaluate({ params }: { params: { id: string } }) {
  const [stage, setStage] = useState('');
  const [crit, setCrit] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score?: number; note: string }>>({});
  const [verdict, setVerdict] = useState('');
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const st = new URLSearchParams(window.location.search).get('stage') || '1차 면접';
    setStage(st);
    api(`/applicants/${params.id}`).then((d) => setName(`${d.applicant.name} · ${d.position.name}`)).catch((e) => setMsg({ t: 'err', m: e.message }));
    api(`/applicants/${params.id}/criteria?stage=${encodeURIComponent(st)}`).then(setCrit).catch((e) => setMsg({ t: 'err', m: e.message }));
    api(`/applicants/${params.id}/evaluations`).then((ev) => {
      const me = getMe();
      const mine = ev.find((e: any) => e.interviewerId === me?.id && e.stage === st);
      if (mine) { setScores(mine.scores); setVerdict(mine.verdict); }
    });
  }, [params.id]);
  const submit = async () => {
    setMsg(null);
    try {
      const r = await api('/evaluations', { body: { applicantId: params.id, stage, scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { score: v.score, note: v.note }])), verdict } });
      setMsg({ t: 'ok', m: r.revised ? '평가를 수정했습니다. 수정 전 내용은 이력으로 남습니다.' : '평가를 제출했습니다. 이제 다른 면접관의 평가를 볼 수 있습니다.' });
    } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  const max = crit[0]?.scale_max, min = crit[0]?.scale_min;
  return (
    <Shell roles={['INTERVIEWER']}>
      <p className="small"><a href={`/applicants/${params.id}`}>← 지원자 상세</a></p>
      <h1>{stage} 평가</h1>
      <p className="desc">{name} · 척도 {min}~{max}점 · 항목마다 점수와 근거를 남깁니다. 제출하기 전에는 다른 면접관의 평가를 볼 수 없습니다.</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      {crit.length === 0 && <div className="note">이 단계의 평가 기준이 없습니다.</div>}
      {crit.map((c) => (
        <div className="card" key={c.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{c.item}</b><span className="small">가중치 {Math.round(c.weight * 100)}%</span></div>
          <p className="small" style={{ margin: '4px 0 8px' }}>{c.description}</p>
          <table><tbody><tr>{Object.entries(c.scale_labels).map(([k, v]: any) => <td key={k} style={{ width: '33%' }}><b className="small">{k}</b><br />{v}</td>)}</tr></tbody></table>
          <div className="row" style={{ marginTop: 8 }}>
            {Array.from({ length: c.scale_max - c.scale_min + 1 }, (_, i) => c.scale_min + i).map((n) => (
              <button key={n} className={scores[c.id]?.score === n ? 'primary' : ''} onClick={() => setScores({ ...scores, [c.id]: { ...(scores[c.id] || { note: '' }), score: n } })}>{n}</button>
            ))}
            <input style={{ flex: 1, minWidth: 260 }} placeholder="근거 (필수)" value={scores[c.id]?.note || ''} onChange={(e) => setScores({ ...scores, [c.id]: { ...(scores[c.id] || {}), note: e.target.value } })} />
          </div>
        </div>
      ))}
      {crit.length > 0 && (
        <div className="card row">
          <b>종합 의견</b>
          {['합격', '보류', '불합격'].map((v) => <button key={v} className={verdict === v ? 'primary' : ''} onClick={() => setVerdict(v)}>{v}</button>)}
          <button className="primary" style={{ marginLeft: 'auto' }} onClick={submit}>제출</button>
        </div>
      )}
    </Shell>
  );
}
