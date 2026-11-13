import './globals.css';
export const metadata = { title: '그린랩스 피플 데스크', description: '채용 관리와 사내 규정 질문 답변' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ko"><body>{children}</body></html>);
}
