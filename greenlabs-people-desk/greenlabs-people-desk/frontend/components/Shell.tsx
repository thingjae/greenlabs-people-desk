'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getMe, Me } from '@/lib/api';

const MENU: Record<string, [string, string][]> = {
  PEOPLE: [['/board', '채용 보드'], ['/intake', '지원서 등록 대기'], ['/schedule', '면접 일정'], ['/stats', '통계'], ['/emails', '메일'], ['/ask', '규정 질문'], ['/inbox', '문의함'], ['/documents', '문서 관리'], ['/settings', '설정']],
  INTERVIEWER: [['/board', '채용 보드'], ['/schedule', '면접 일정'], ['/ask', '규정 질문']],
  EMPLOYEE: [['/ask', '규정 질문'], ['/inbox', '내 문의']],
};
const ROLE: Record<string, string> = { PEOPLE: '피플팀', INTERVIEWER: '면접관', EMPLOYEE: '직원' };

export default function Shell({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const [me, setMe] = useState<Me | null>(null);
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const m = getMe();
    if (!m) { router.replace('/login'); return; }
    if (roles && !roles.includes(m.role)) { router.replace(MENU[m.role][0][0]); return; }
    setMe(m);
  }, [path]);
  if (!me) return null;
  return (
    <div className="shell">
      <nav className="side">
        <div className="logo">그린랩스 피플 데스크</div>
        <div className="sub">채용 · 규정 문의</div>
        {MENU[me.role].map(([href, label]) => (
          <a key={href} href={href} className={path.startsWith(href) ? 'on' : ''}>{label}</a>
        ))}
        <div className="me">
          <div><b>{me.name}</b> · {ROLE[me.role]}</div>
          <div>{me.title}{me.employmentType ? ` · ${me.employmentType}` : ''}</div>
          <button style={{ marginTop: 8, width: '100%' }} onClick={() => { clearSession(); router.replace('/login'); }}>로그아웃 · 계정 바꾸기</button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
