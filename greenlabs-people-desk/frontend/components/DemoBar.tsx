'use client';
import { useEffect, useState } from 'react';
import { SCENARIOS, getDemo, startScenario, exitDemo, resetDemo, Scenario } from '@/lib/demo';

/** 체험 모드일 때 화면 위에 붙는 안내 막대: 지금 할 일 · 성공 화면 · 역할 바꾸기 · 처음부터 다시 */
export default function DemoBar() {
  const [sc, setSc] = useState<Scenario | null>(null);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState('');
  useEffect(() => { const d = getDemo(); if (d) setSc(SCENARIOS.find((s) => s.id === d.scenario) || null); }, []);
  if (!sc) return null;
  const run = async (label: string, fn: () => Promise<void> | void) => { setBusy(label); try { await fn(); } catch (e: any) { alert(e.message); setBusy(''); } };
  return (
    <div className="demobar">
      <div className="demobar-top">
        <span className="demotag">체험 중</span>
        <b>{sc.title}</b><span className="small"> · {sc.who}</span>
        <button className="link" onClick={() => setOpen(!open)}>{open ? '안내 접기' : '안내 펼치기'}</button>
        <span style={{ marginLeft: 'auto' }} />
        <select value="" onChange={(e) => e.target.value && run('switch', () => startScenario(e.target.value))}>
          <option value="">다른 체험으로 바꾸기</option>
          {SCENARIOS.filter((s) => s.id !== sc.id).map((s) => <option key={s.id} value={s.id}>{s.title} ({s.who.split(' ')[0]})</option>)}
        </select>
        <button disabled={!!busy} onClick={() => confirm('가상 데이터를 처음 상태로 되돌릴까요? 지금 체험 중인 다른 사람의 기록도 함께 지워집니다.') && run('reset', resetDemo)}>{busy === 'reset' ? '되돌리는 중…' : '처음부터 다시'}</button>
        <button onClick={exitDemo}>체험 끝내기</button>
      </div>
      {open && (
        <div className="demobar-body">
          <div><div className="small">할 일</div><ol>{sc.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
          <div><div className="small">이렇게 보이면 성공</div><ul>{sc.success.map((s, i) => <li key={i}>{s}</li>)}</ul>
            <div className="small" style={{ marginTop: 6 }}>⏸ {sc.pause}</div></div>
        </div>
      )}
    </div>
  );
}
