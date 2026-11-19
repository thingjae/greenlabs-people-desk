'use client';
import { useEffect, useState } from 'react';
import { SCENARIOS, startScenario } from '@/lib/demo';

const ROLE_LABEL: Record<string, string> = { PEOPLE: '피플팀', INTERVIEWER: '면접관', EMPLOYEE: '직원' };

export default function Demo() {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [reset, setReset] = useState(false);
  useEffect(() => { setReset(new URLSearchParams(window.location.search).get('reset') === '1'); }, []);
  const go = async (id: string) => { setBusy(id); setErr(''); try { await startScenario(id); } catch (e: any) { setErr(e.message); setBusy(''); } };
  return (
    <div className="lp">
      <nav className="lp-nav"><a href="/" className="lp-logo">그린랩스 피플 데스크</a><a href="/">소개로 돌아가기</a></nav>
      <section className="lp-sec">
        <h1 className="lp-h1" style={{ fontSize: 32 }}>로그인 없이 바로 체험하기</h1>
        <p className="lp-lead">체험할 장면을 고르면 해당 역할의 가상 계정으로 바로 들어갑니다. 회원가입이나 비밀번호는 필요 없습니다. 체험하는 동안 화면 위의 안내 막대가 할 일과 성공 화면을 알려 줍니다.</p>
        {reset && <div className="ok">가상 데이터를 처음 상태로 되돌렸습니다. 다시 골라 시작하세요.</div>}
        {err && <div className="err">{err}</div>}
        <div className="demo-grid">
          {SCENARIOS.map((s, i) => (
            <div key={s.id} className={`demo-card ${i === 0 ? 'main' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="demotag">{ROLE_LABEL[s.role]}</span><span className="small">약 {s.minutes}분</span>
              </div>
              <h3>{s.title}</h3>
              <div className="small">{s.who}으로 입장</div>
              <ol>{s.steps.map((t, j) => <li key={j}>{t}</li>)}</ol>
              <div className="success">✓ {s.success.join(' / ')}</div>
              <button className="primary" disabled={!!busy} onClick={() => go(s.id)}>{busy === s.id ? '들어가는 중…' : i === 0 ? '이 체험부터 시작 (추천)' : '시작'}</button>
            </div>
          ))}
        </div>
        <div className="note" style={{ marginTop: 18 }}>
          <b>체험 전에 알아 두세요</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>지원자 400명, 포지션 6개, 규정 문서 3종은 모두 <b>가상 데이터</b>입니다. 메일은 실제로 보내지 않습니다.</li>
            <li>체험하는 모든 사람이 <b>같은 가상 데이터를 함께 씁니다.</b> "처음부터 다시"를 누르면 다른 사람의 체험 기록도 지워집니다.</li>
            <li>AI 답변은 공용 키를 써서 몇 초 걸릴 수 있습니다.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
