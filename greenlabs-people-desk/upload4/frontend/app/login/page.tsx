'use client';
import { useState } from 'react';
import { api, setSession } from '@/lib/api';
const ACCOUNTS = [
  ['seo@greenlabs.test', '서지원', '피플팀 매니저', '채용 보드 · 지원서 등록 · 일정 확정 · 메일 · 문서 관리'],
  ['head@greenlabs.test', '최현아', '피플팀장', '통계 · 문의함'],
  ['park@greenlabs.test', '박도현', '면접관 (개발팀장)', 'P01·P02·P04 2차 면접관 — 이 세 포지션만 보임'],
  ['lee@greenlabs.test', '이서준', '면접관 (플랫폼개발팀)', 'P01 1차 면접관'],
  ['han@greenlabs.test', '한지민', '면접관 (플랫폼개발팀)', 'P01 1차 면접관'],
  ['song@greenlabs.test', '송유나', '면접관 (디자인팀장)', 'P03 2차 면접관'],
  ['emp1@greenlabs.test', '김정규', '직원 · 정규직', '규정 질문'],
  ['emp2@greenlabs.test', '한수습', '직원 · 수습 (입사 2개월)', '규정 질문 — 고용 형태별 답변 확인용'],
];
export default function Login() {
  const [err, setErr] = useState('');
  const go = async (email: string) => {
    setErr('');
    try {
      const r = await api('/auth/login', { body: { email, password: 'demo1234' } });
      setSession(r.token, r.user);
      window.location.href = r.user.role === 'EMPLOYEE' ? '/ask' : '/board';
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="login">
      <h1>그린랩스 피플 데스크</h1>
      <p className="desc">시연용 계정을 고르세요. 모든 데이터는 가상입니다. (비밀번호: demo1234)</p>
      <div className="note" style={{ marginBottom: 14 }}>
        <b>처음 오셨나요? 3분 체험</b>
        <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li><b>서지원(피플팀)</b>으로 들어가 왼쪽 <b>지원서 등록 대기</b> → 예시 <b>원티드 형식</b> → <b>항목 채우기</b></li>
          <li>채워진 값을 확인하고 <b>확인했고 등록</b></li>
          <li><b>채용 보드 → P01 백엔드 개발자 → 서류</b> 칸에서 방금 등록한 지원자 찾기</li>
        </ol>
        <div className="small" style={{ marginTop: 6 }}>시연을 마치면 설정 → 데모 데이터 초기화를 눌러 주세요.</div>
      </div>
      {err && <div className="err">{err}</div>}
      {ACCOUNTS.map(([email, name, role, d]) => (
        <button key={email} onClick={() => go(email)}>
          <b>{name}</b> · {role}<br /><span className="small">{d}</span>
        </button>
      ))}
    </div>
  );
}
