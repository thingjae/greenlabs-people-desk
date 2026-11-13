# 그린랩스 피플 데스크

> FDE 빌더 해커톤 · 고객사 **20. 스타트업 인사팀 "그린랩스 피플팀"**

피플팀이 **메일을 뒤지지 않고** 채용 진행 상황과 다음 할 일을 한 화면에서 보고, 직원의 반복 질문은 **근거 문서와 함께** 자동으로 답하는 사내 채용·HR 데스크입니다.

- **배포 주소: https://greenlabs-people-desk.vercel.app** (백엔드 API: https://greenlabs-people-desk-production.up.railway.app, 상태 확인 `/health`)
- 산출물: [`docs/`](docs) — 요구사항 정의서, 기획서, 기능 명세서, 테스트 결과표
- 가상 자료: [`data/`](data) — 규정집(구버전·개정판), 복지 가이드, 경비 지침, 지원자 400명, 평가 기준표 ([자료 안내](data/README.md))

## 주요 기능

| 기능 | 내용 |
|---|---|
| 채용 보드 | 포지션별 단계 칸, 카드마다 **다음 할 일·다음 담당자**, 배지(안내 기한 초과·임박, 과제 기한 초과, 평가 미제출, 중복 지원, 확인 필요), 오늘 할 일 요약 |
| 지원자 상세 | 단계 이동·불합격·중도 이탈(사유), 처우 정보·이전 지원 기록(피플팀만), 메일 초안·발송 기록 |
| 지원서 자동 입력 (AI) | 지원서 메일을 붙여 넣으면 항목을 채워 **등록 대기** → 피플팀 확인 후 등록, 같은 이메일 지원 기록 표시 |
| 면접 평가 | 포지션별 기준표·척도, **본인 제출 전 다른 면접관 평가 비공개**, 수정 이력 |
| 면접 일정 | 면접관 가능 시간 입력 → 배정 면접관 **모두 가능한 시간**에서 피플팀이 확정 |
| 통계 | 앞 단계 대비 통과율(기본) + 전체 대비, 채용 사이트별 서류 통과율·면접 진출·입사, 불합격과 중도 이탈 분리 |
| 규정 질문 (AI) | 사내 문서 근거로 답변 + 문서·개정일·조항·쪽 표시, **문서 개정일이 최신인 문서 우선** + 충돌 표시, 민감·근거 없는 질문은 피플팀 이관 |
| 문서 관리 | PDF + 개정일 업로드 → 즉시 반영, 이전 버전 보관·되돌리기 |
| 문의함 | 피플팀으로 넘어온 질문에 답변 → 직원의 '내 문의'에 표시 |
| 보관 기간 | 불합격·중도 이탈 후 보관 기간(설정값)이 지나면 "파기 대상" 표시 |

## 데모 계정 (비밀번호 모두 `demo1234`, 로그인 화면에서 버튼으로 선택)

| 계정 | 역할 | 볼 수 있는 것 |
|---|---|---|
| seo@greenlabs.test | 피플팀 매니저 서지원 | 전체 |
| head@greenlabs.test | 피플팀장 최현아 | 전체 |
| park@greenlabs.test | 면접관 박도현 (개발팀장) | P01·P02·P04 (2차) |
| lee@greenlabs.test / han@greenlabs.test | 면접관 이서준 / 한지민 | P01 (1차) |
| song@greenlabs.test | 면접관 송유나 (디자인팀장) | P03 (2차) |
| emp1@greenlabs.test / emp2@greenlabs.test | 직원 김정규(정규직) / 한수습(수습) | 규정 질문 |

## 저장소 구조 안내

실제 코드는 `greenlabs-people-desk/` 폴더 안에 있습니다. 그 안의 `greenlabs-people-desk/` 하위 폴더는 업로드 중 생긴 불완전한 사본이라 사용하지 않습니다.

## 구조

```
backend/   NestJS + PostgreSQL(pg) · 포트 4000 · 시작할 때 테이블 생성, DB가 비어 있으면 시드
  src/auth.ts                 로그인(JWT), 역할 가드, 포지션 단위 열람 권한
  src/applicants.controller.ts 보드·상세·단계 이동 (다음 할 일·배지 계산)
  src/hiring.controller.ts     평가·면접 일정·통계
  src/support.controller.ts    문서·질문 답변·지원서 자동 입력·메일·설정
  src/documents.ts            PDF → 쪽·조항 단위 조각 → 임베딩
  src/ai.ts                   OpenAI 호출 (키가 없으면 키워드 검색으로 대체)
  seed-data/                  시드용 가상 자료
  tests/api.test.mjs          API 시험 스크립트 (테스트 결과표 근거)
frontend/  Next.js 14 (App Router)
docs/      산출물
data/      가상 자료 원본
```

## 로컬 실행

```bash
# 1) PostgreSQL 준비 후
cd backend && cp .env.example .env   # DATABASE_URL, JWT_SECRET, OPENAI_API_KEY 채우기
npm install && npm run build && npm start      # http://localhost:4000 (첫 실행 때 시드)
# 2)
cd frontend && echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm install && npm run dev                     # http://localhost:3000
```

## 환경 변수 (값은 저장소에 넣지 않음)

| 위치 | 이름 | 설명 |
|---|---|---|
| backend | `DATABASE_URL` | PostgreSQL 주소 |
| backend | `DATABASE_SSL` | 외부 DB가 SSL을 요구하면 `true` |
| backend | `JWT_SECRET` | 임의의 긴 문자열 |
| backend | `FRONTEND_URL` | CORS 허용 주소 (쉼표로 여러 개) |
| backend | `OPENAI_API_KEY` | AI 기능용 키 |
| backend | `OPENAI_MODEL` / `OPENAI_EMBED_MODEL` | 기본 `gpt-4o-mini` / `text-embedding-3-small` |
| backend | `DEMO_TODAY` | 시연 기준일 고정 (예: `2026-11-13`). 비우면 오늘(한국 시간) |
| frontend | `NEXT_PUBLIC_API_URL` | 백엔드 주소 |

## 알려진 제약

- 메일은 실제로 보내지 않고 초안과 발송 기록만 남깁니다.
- 영업일 계산은 주말만 빼고 공휴일은 반영하지 않습니다.
- 슬랙 연동, 온보딩 요청, 지원자의 면접 시간 직접 선택은 다음 단계로 미뤘습니다 (기획서 4-2).
