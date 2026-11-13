'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function Stats() {
  const [d, setD] = useState<any>(null);
  const [pid, setPid] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api('/stats' + (pid ? `?positionId=${pid}` : '')).then(setD).catch((e) => setErr(e.message)); }, [pid]);
  return (
    <Shell roles={['PEOPLE']}>
      <h1>채용 통계</h1>
      <p className="desc">어느 단계에서 지원자가 많이 빠지는지(병목)와 어느 채용 사이트에서 좋은 지원자가 오는지 봅니다.</p>
      {err && <div className="err">{err}</div>}
      {d && (
        <>
          <div className="tabs">{d.positions.map((p: any) => <button key={p.id} className={d.position.id === p.id ? 'on' : ''} onClick={() => setPid(p.id)}>{p.id} {p.name}</button>)}</div>
          <div className="chips">
            <span className="chip">전체 지원<b>{d.total}</b></span>
            <span className="chip">불합격(회사 결정)<b>{d.rejected}</b></span>
            <span className="chip">중도 이탈(지원자 결정)<b>{d.dropped}</b></span>
            {d.missingStage > 0 && <span className="chip org">단계 누락(계산 제외)<b>{d.missingStage}</b></span>}
          </div>
          <div className="card">
            <h3>단계별 통과율</h3>
            <table><thead><tr><th style={{ width: 90 }}>단계</th><th>도달 인원</th><th style={{ width: 120 }}>앞 단계 대비</th><th style={{ width: 100 }}>전체 대비</th><th>진행 중</th><th>여기서 불합격</th><th>여기서 이탈</th></tr></thead><tbody>
              {d.funnel.map((f: any, i: number) => (
                <tr key={f.stage}>
                  <td><b>{f.stage}</b></td>
                  <td><div className="bar" style={{ width: `${Math.max(4, (f.reached / (d.funnel[0].reached || 1)) * 100)}%` }}>{f.reached}명</div></td>
                  <td><b style={{ fontSize: 16, color: i > 0 && f.fromPrevRate < 40 ? 'var(--red)' : 'inherit' }}>{i === 0 ? '-' : `${f.fromPrevRate}%`}</b></td>
                  <td className="small">{f.fromTotalRate}%</td>
                  <td>{f.inProgress}</td><td>{f.rejectedHere}</td><td>{f.droppedHere}</td>
                </tr>
              ))}
            </tbody></table>
            <p className="small">{d.formula}{!d.position.has_task && ' · 이 포지션은 과제 전형이 없습니다.'} · 앞 단계 대비 40% 미만은 빨간색(병목 후보)</p>
          </div>
          <div className="card">
            <h3>채용 사이트별 성과</h3>
            <table><thead><tr><th>지원 경로</th><th>지원 수</th><th>서류 통과율</th><th>면접 진출</th><th>입사</th></tr></thead><tbody>
              {d.sources.map((s: any) => <tr key={s.source}><td>{s.source}</td><td>{s.applicants}</td><td>{s.docPassRate === null ? '-' : `${s.docPassRate}%`}</td><td>{s.interviews}</td><td>{s.hires}</td></tr>)}
            </tbody></table>
            <p className="small">서류 통과율 = 서류 결과가 나온 지원자 중 다음 단계로 간 비율 (진행 중인 서류 지원자는 제외)</p>
          </div>
        </>
      )}
    </Shell>
  );
}
