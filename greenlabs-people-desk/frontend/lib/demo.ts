'use client';
import { api, setSession, clearSession } from './api';

export type DemoRole = 'PEOPLE' | 'INTERVIEWER' | 'EMPLOYEE';
export interface Scenario {
  id: string; role: DemoRole; who: string; title: string; minutes: number; start: string;
  steps: string[]; success: string[]; pause: string;
}

/** 체험 시나리오. 각 단계는 실제 화면의 버튼 이름 그대로 적는다. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'intake', role: 'PEOPLE', who: '피플팀 매니저 서지원', title: '지원서 한 건 등록하고 다시 찾기', minutes: 3, start: '/intake',
    steps: [
      '예시 버튼 "원티드 형식"을 누릅니다',
      '"항목 채우기"를 누르면 AI가 이름·이메일·연락처·포지션·지원 경로를 채웁니다',
      '노란 칸이 있으면 고친 뒤 "확인했고 등록"을 누릅니다',
      '왼쪽 "채용 보드" → P01 백엔드 개발자 → 검색창에 "정다온"',
    ],
    success: ['보드 "서류" 칸에 정다온 카드와 "▶ 서류 검토 · 피플팀"', '카드를 열면 단계 이력에 "지원서 자동 입력 승인"'],
    pause: '등록 전에 "반려"를 누르면 지원자로 등록되지 않습니다',
  },
  {
    id: 'notice', role: 'PEOPLE', who: '피플팀 매니저 서지원', title: '늦어진 불합격 안내 처리하기', minutes: 2, start: '/board?positionId=P01',
    steps: [
      '위쪽 칩 "안내 기한 초과"를 누릅니다',
      '빨간 배지가 붙은 카드를 엽니다',
      '아래 메일 영역에서 "불합격 초안"을 누르고 내용을 확인합니다',
      '"발송 완료 처리"를 누릅니다 (시연에서는 실제로 보내지 않습니다)',
    ],
    success: ['카드의 "안내 기한 초과" 배지가 사라지고 결과 안내일이 기록됨'],
    pause: '초안은 발송 전에 얼마든지 고칠 수 있습니다',
  },
  {
    id: 'ask', role: 'EMPLOYEE', who: '직원 김정규 (정규직)', title: '규정 묻고 근거 확인하기', minutes: 2, start: '/ask',
    steps: [
      '예시 질문 "출장 택시비 한도가 얼마예요?"를 누릅니다',
      '답 아래 근거(문서·개정일·조항·쪽)와 노란 "문서끼리 다름" 안내를 봅니다',
      '"아이가 아파서 병원에 가야 하는데…"를 누릅니다',
    ],
    success: ['택시비: 근거 카드와 함께 답변', '개인 사정 질문: 자동 답 없이 "피플팀 전달"'],
    pause: '근거를 못 찾은 질문도 AI가 지어내지 않고 피플팀에 넘깁니다',
  },
  {
    id: 'interviewer', role: 'INTERVIEWER', who: '면접관 박도현 (개발팀장)', title: '담당 포지션만 보이는지 확인하기', minutes: 1, start: '/board',
    steps: [
      '위쪽 포지션 탭을 봅니다: P01·P02·P04만 있습니다',
      '아무 카드나 열어 봅니다',
    ],
    success: ['연봉, 이전 지원 기록, 단계 결정 버튼이 보이지 않음', '다른 면접관 평가는 본인이 제출하기 전까지 잠김'],
    pause: '단계 이동과 불합격 확정은 피플팀만 할 수 있습니다',
  },
];

const KEY = 'gl_demo';
export function getDemo(): { scenario: string } | null { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
export function setDemo(v: { scenario: string } | null) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} }

/** 로그인 없이 역할로 입장해서 시나리오 시작 화면으로 이동 */
export async function startScenario(id: string) {
  const sc = SCENARIOS.find((s) => s.id === id)!;
  const r = await api('/auth/demo', { body: { role: sc.role } });
  setSession(r.token, r.user);
  setDemo({ scenario: id });
  window.location.href = sc.start;
}

export function exitDemo() { setDemo(null); clearSession(); window.location.href = '/'; }

/** 가상 데이터를 처음 상태로 되돌리고 체험 첫 화면으로 */
export async function resetDemo() {
  await api('/admin/reset-demo', { body: {} });
  setDemo(null); clearSession(); window.location.href = '/demo?reset=1';
}
