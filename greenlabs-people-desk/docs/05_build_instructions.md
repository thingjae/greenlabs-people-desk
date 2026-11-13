# Claude Code 구현 지시문

단계마다 아래 블록을 **그대로 복사해 Claude Code에 붙여 넣으세요.** 한 단계가 끝나면 확인 항목을 직접 눌러 본 뒤 커밋하고 다음 단계로 넘어갑니다.

| 단계 | 내용 | 예상 시간 | 목표 완료 |
|---|---|---|---|
| 0 | 준비 (저장소, 파일 배치) | 5분 | 11:45 |
| 1 | 뼈대·DB·시드·로그인·권한 | 25분 | 12:10 |
| 2 | 채용 보드·지원자 상세·단계 이동 | 25분 | 12:35 |
| 3 | 평가·면접 일정·통계 | 25분 | 13:00 |
| 4 | 직원 질문 답변(AI)·문서 업로드 | 25분 | 13:25 |
| 5 | 지원서 자동 입력(AI)·메일·설정 | 15분 | 13:40 |
| 6 | 배포 | 20분 | 14:00 |

**밀릴 때 줄이는 순서:** 5단계의 메일 템플릿 편집 화면 → 설정 화면 → 3단계 통계의 사이트별 표. 그 밖은 기본 요구사항이나 고객이 확정한 기능이라 빼면 안 됩니다.

---

## 0단계: 준비 (직접)

```
greenlabs-people-desk/
├─ docs/      ← 00_인터뷰기록.md, 01~03 문서
├─ data/      ← 가상 자료 6개 (PDF 4, xlsx 2)
├─ backend/   ← 1단계에서 생성
└─ frontend/  ← 1단계에서 생성
```

`backend/.env`는 직접 만들고 **절대 커밋하지 않습니다.**
```
DATABASE_URL=postgresql://...       # 로컬 또는 Railway
OPENAI_API_KEY=(수업에서 받은 키)
OPENAI_MODEL=gpt-4o-mini            # 수업에서 안내한 모델이 있으면 그걸로
OPENAI_EMBED_MODEL=text-embedding-3-small
JWT_SECRET=아무_긴_문자열
```

---

## 1단계: 뼈대·DB·시드·로그인·권한 (약 25분)

```
docs/03_functional_spec.md를 읽고 그대로 구현을 시작해. 이번 단계 범위는 뼈대, DB, 시드, 로그인, 권한까지야.

1) 모노레포 구성
- backend: NestJS + Prisma + PostgreSQL. 포트 4000. CORS는 FRONTEND_URL 환경변수 허용.
- frontend: Next.js(App Router, TypeScript, Tailwind). NEXT_PUBLIC_API_URL로 백엔드 호출.
- 루트 .gitignore에 .env, node_modules, .next, dist 포함. backend/.env.example 만들기(값은 비워 둠).

2) Prisma 스키마: 명세서 2-1의 테이블 전부 (users, positions, position_interviewers, applicants, stage_histories, eval_criteria, evaluations, evaluation_revisions, availabilities, interviews, intake_drafts, email_templates, email_logs, documents, doc_chunks, qa_logs, settings). doc_chunks.embedding은 Float[].

3) 시드 스크립트 (npm run seed, xlsx 패키지 사용)
- data/positions_applicants.xlsx: '포지션' 시트 → positions, '지원자' 시트 400행 → applicants.
  - 연락처는 숫자만 뽑아 010-0000-0000 형식으로 정규화 (규칙 B12)
  - 현재 단계나 지원 경로가 비면 needs_review=true, review_note에 사유 (B13)
  - 엑셀의 '메모' 열은 review_note에 함께 보존
- data/interview_eval_criteria.xlsx: 포지션별 시트 → eval_criteria. 척도: P01~P04는 1~5, P05는 1~4, P06은 1~3.
- 데모 계정 (비밀번호 모두 demo1234):
  - PEOPLE: 서 매니저 seo@greenlabs.test, 피플팀장 head@greenlabs.test
  - INTERVIEWER: 박도현 park@greenlabs.test (P01·P02·P04 SECOND), 이서준 lee@greenlabs.test (P01 FIRST), 송유나 song@greenlabs.test (P03 SECOND)
  - EMPLOYEE: 김정규 emp1@greenlabs.test(정규직), 한수습 emp2@greenlabs.test(수습)
- settings 기본값: 불합격 안내 기한 5영업일, 평가 제출 기한 2영업일, 면접 길이 60분, 보관 기간 180일
- email_templates 5종(접수, 과제, 면접 일정, 합격, 불합격) 기본 문구, 변수 {{이름}} {{포지션}} {{일시}}

4) 인증·권한
- POST /auth/login → JWT(id, role). JwtAuthGuard + RolesGuard + @Roles 데코레이터.
- ApplicantAccessGuard: INTERVIEWER는 position_interviewers에 배정된 포지션 지원자만 (B1). 목록 쿼리에도 같은 조건.
- 응답 직렬화: salary_offer와 중복 지원 기록은 PEOPLE에게만 (B2).

5) 프론트
- /login: 데모 계정 버튼 7개(누르면 바로 로그인). 토큰은 메모리+localStorage.
- 로그인 후 역할별 메뉴: PEOPLE(보드, 등록 대기, 일정, 통계, 메일, 질문, 문서, 문의함, 설정) / INTERVIEWER(보드, 일정, 질문) / EMPLOYEE(질문)
- 화면은 빈 껍데기만 만들어 두고 다음 단계에서 채움.

끝나면 로컬에서 마이그레이션·시드를 실행하고, park@greenlabs.test로 GET /applicants를 호출했을 때 P01·P02·P04 지원자만 나오는지 확인해서 결과를 알려 줘.
```

**확인:** 박도현 로그인 시 P03·P05·P06 지원자가 안 나오는가 / 지원자 400명이 들어갔는가

---

## 2단계: 채용 보드·지원자 상세·단계 이동 (약 25분)

```
docs/03_functional_spec.md의 S1, S2와 규칙 B3, B4, B5, B11을 구현해.

백엔드
- GET /board?positionId= : 단계별로 묶은 지원자 카드. 카드마다 계산 값 포함:
  - nextAction(다음 할 일)과 nextOwner(다음 담당자):
    서류→"서류 검토"/피플팀, 과제→"과제 제출 대기" 또는 "과제 검토"/1차 면접관, 1차·2차 면접→일정 없음이면 "일정 확정"/피플팀, 일정 있고 평가 미제출이면 "평가 제출"/해당 면접관, 평가 모두 제출이면 "단계 결정"/피플팀, 처우 협의→"처우 협의"/피플팀, 불합격이고 result_notified_at 없음→"불합격 안내"/피플팀
  - badges: 안내 기한(결정일+5영업일, 주말 제외. 남은 영업일 ≤1이면 D-1, 지나면 초과) (B4), 과제 기한 초과 (B5, 자동 불합격 금지), 평가 미제출(면접일+2영업일 초과), 중복 지원/중복 의심 (B11, PEOPLE에게만), 확인 필요(needs_review)
- 상단 요약: 오늘 할 일 수(안내 기한 초과·D-1, 일정 미확정, 평가 미제출, 확인 필요)
- POST /applicants/:id/transition {to, reason} : PEOPLE만. 순서 검증(과제 없는 포지션은 과제 건너뜀). 불합격·중도 이탈은 end_stage=현재 단계, 중도 이탈은 reason 필수(지원 취소/처우 결렬/입사 포기/과제 미제출). stage_histories에 기록 (B3)
- GET /applicants/:id : 기본 정보, 단계 이력, 평가 요약, 일정, 메일 기록. PEOPLE은 salary_offer와 같은 이메일 지원 기록(B11)까지.
- PATCH /applicants/:id : PEOPLE만. needs_review 해소(단계·지원 경로 입력), salary_offer 입력.

프론트
- /board: 포지션 탭(면접관은 배정 포지션만), 진행 칸 6개(서류~입사) + 접힌 종료 칸(불합격, 중도 이탈). 카드에 이름, 지원 경로, 다음 할 일·담당자, 배지 색상(초과=빨강, D-1=주황, 확인 필요=노랑). 상단 오늘 할 일 요약 칩(누르면 필터).
- /applicants/[id]: 상세. PEOPLE에게만 단계 이동 버튼, 불합격, 중도 이탈(사유 선택), 연봉 칸, "같은 이메일 지원 기록" 박스.
- 디자인: 깔끔한 관리자 화면, 한국어 UI.

확인: A0082(안내 지연), A0191(과제 기한 초과), A0127↔A0265(중복), A0133(단계 누락)이 각각 올바른 배지로 보이는지 알려 줘.
```

---

## 3단계: 평가·면접 일정·통계 (약 25분)

```
docs/03_functional_spec.md의 S4, S5, S6과 규칙 B6, B7, B8, B9, B19를 구현해.

평가
- GET /applicants/:id/criteria?stage= : 포지션·단계별 기준표
- POST /evaluations : INTERVIEWER, 배정된 포지션·단계만. 항목별 점수는 scale_min~max 범위 검증(B7), 근거 필수, verdict(합격/보류/불합격). 제출 시 submitted_at.
- PATCH /evaluations/:id : 제출 후 수정 시 evaluation_revisions에 이전 값 저장(B8)
- GET /applicants/:id/evaluations : 요청한 면접관이 해당 단계 평가를 제출하지 않았으면 다른 면접관 평가는 내용 없이 "제출 후 공개"로만 반환(B6). PEOPLE은 전체 + 가중 평균 점수.
- 프론트 /applicants/[id]/evaluate: 기준표 표(항목, 설명, 가중치, 척도별 기준) + 점수 버튼 + 근거 입력 + 종합 의견 + 제출

면접 일정
- 면접관: POST/DELETE /availabilities (본인 것만). 프론트 /schedule: 이번 주와 다음 주 평일 9~18시 1시간 칸을 눌러 가능 시간 저장
- 피플팀: GET /interviews/slots?applicantId=&stage= → 그 단계에 배정된 면접관 모두가 가능한 구간(면접 길이 설정값 기준) (B9)
- POST /interviews : PEOPLE만. 모두 가능한 구간인지 서버에서 재검증. 확정하면 '면접 일정' 템플릿으로 email_logs 초안 생성.
- 시연용 시드: 박도현·이서준의 가능 시간을 다음 주 화·수 오후에 몇 칸 겹치게 넣어 둬.

통계 (PEOPLE)
- GET /stats?positionId= : B19 정의대로 단계별 도달 수, 앞 단계 대비 통과율(기본), 전체 대비(보조). 과제 없는 포지션은 과제 제외. 단계 누락 행은 분모 제외하고 건수 별도. 불합격과 중도 이탈 수 분리.
- 사이트별: 지원 수, 서류 통과율, 면접 진출 수, 입사 수
- 프론트 /stats: 포지션 선택 + 퍼널 막대(앞 단계 대비 % 크게, 전체 대비 % 작게) + 사이트별 표. 계산식을 화면 하단에 한 줄로 표시.

확인: 이서준 로그인 → P01 지원자 평가 제출 전에는 박도현 평가가 가려지는지, 점수 6점 입력이 P01에서 막히는지 알려 줘.
```

---

## 4단계: 직원 질문 답변(AI)·문서 업로드 (약 25분)

```
docs/03_functional_spec.md의 S8, S9, S10과 규칙 B14~B18, AI-1을 구현해. OpenAI 호출은 백엔드에서만, 키는 환경변수에서만 읽어.

문서
- POST /documents (PEOPLE, multipart): PDF + doc_type(규정집/복지 가이드/경비 지침) + revised_at(필수) (B14)
  - pdf-parse 등으로 쪽 단위 텍스트 추출 → 조항 단위로 분할: '제N조(' 패턴이 있으면 조항 단위, 없으면 '제N장'·'N.' 소제목 단위. 각 조각에 page, article(예: '제16조(출장)' 또는 '제6장 2. 재택근무 안내') 저장
  - 머리말/바닥글(문서명, 개정일, '- n / N -')은 제거
  - 임베딩을 한 번에 배치로 만들어 저장 (공용 키라 호출 수 최소화)
  - 같은 doc_type의 이전 문서는 is_active=false
- 시드: data/의 규정집 '구버전(2026-03-01)', 복지 가이드(2026-01-02), 경비 지침(2026-07-01)을 활성 문서로 미리 올려 둬. 개정판(2026-10-01)은 시연 때 화면에서 업로드할 거야.
- 프론트 /documents: 업로드 폼(종류, 개정일, 파일), 버전 목록(활성 표시)

질문 답변 POST /qa/ask
1) 민감 분류(B16): 건강·질병·진단·가족 사정·임신·징계·괴롭힘·성희롱·남의 급여 등 키워드 우선 검사 + LLM 분류(JSON {sensitive, reason}). 민감이면 AI 답변 생성 없이 status=이관, 화면에 "개인 사정이 포함된 질문은 피플팀이 직접 답드립니다".
2) 활성 문서 조각에서 코사인 유사도 상위 6개 검색.
3) LLM 호출. 시스템 프롬프트 요지:
   - 제공된 조각 안의 내용으로만 답한다. 없으면 grounded=false.
   - 여러 문서가 같은 항목을 다르게 적었으면 문서 개정일(revised_at)이 더 최근인 문서를 따르고, conflict에 다른 문서 값을 적는다.
   - 고용 형태(정규직/수습/계약직/인턴)별로 다르면 applies_to에 적고, 질문자의 고용 형태(users.employment_type)에 맞는 답을 먼저 한다.
   - JSON {answer, citations:[{doc, revised_at, article, page, quote}], conflict, grounded, applies_to}
4) 서버 후처리: conflict가 있으면 두 문서의 revised_at을 직접 비교해 채택 문서를 확정(B15). grounded=false거나 citations가 비면 이관(근거 없음) (B17).
5) qa_logs 저장. 민감 질문 로그는 PEOPLE과 본인만 조회(B18).
- 프론트 /ask: 채팅 UI. 답변 아래 근거 카드(문서명 · 개정일 · 조항 · 쪽 · 인용), 충돌 안내 박스, 이관 안내. 예시 질문 버튼: "출장 택시비 한도가 얼마예요?", "육아휴직 쓰면 연차는 어떻게 돼요?", "재택근무 주 몇 일까지 돼요?", "수습인데 재택 가능해요?"
- 프론트 /inbox (PEOPLE): 질문 기록, 이관 목록, 처리 완료 버튼

확인 (결과 알려 줘):
- 구버전 상태에서 "재택근무 주 몇 일?" → 주 2일
- 개정판 업로드 후 같은 질문 → 주 3일, "출장 택시비 한도?" → 30,000원 + "경비 처리 지침은 40,000원이지만 개정일이 더 최근인 사내 규정집을 따름"
- "야근하고 밤 11시에 택시 타면?" → 50,000원(경비 지침 제7조, 충돌 아님)
- "아이가 아파서 병원 가야 하는데 병가 쓰면 되나요?" → 이관
- "재택 통신비는 어떻게 신청해요?" → 근거 없음 이관(복지 가이드에 방법이 없음)
```

---

## 5단계: 지원서 자동 입력(AI)·메일·설정 (약 15분)

```
docs/03_functional_spec.md의 S3, S7, S11과 규칙 B10, B11, B12, B20, AI-2를 구현해.

지원서 자동 입력 (PEOPLE)
- POST /intake/extract {rawText}: LLM으로 {name,email,phone,source,position_id,applied_at,low_confidence[]} 추출. 포지션·지원 경로는 DB 목록 중에서만 고르게 하고, 모르면 null. 연락처 정규화(B12). 중복 검사(B11: 이메일 일치=중복 지원, 이름+연락처 일치=중복 의심). intake_drafts에 '대기'로 저장(B10). 여러 건을 '---'로 구분해 한 번에 붙여 넣으면 건별로 처리.
- POST /intake/:id/approve (수정값 포함): 필수값(이름, 이메일, 포지션, 지원 경로) 검증 후 applicants 생성(단계=서류). /reject도.
- 프론트 /intake: 왼쪽 붙여 넣기 칸, 오른쪽 대기 목록 카드(추출값 수정 가능, low_confidence 칸 노란색, 중복 배지 + 기존 지원 기록 링크, 승인/반려)
- 예시 버튼 3개로 아래 같은 가상 지원서를 채워 넣게 해 줘(사이트마다 형식이 다르게): 원티드 형식, 사람인 형식, 그리고 기존 지원자 A0127과 같은 이메일을 쓴 지원서 1건 (이메일은 DB에서 가져와)

메일 (PEOPLE)
- 템플릿 편집 화면, 지원자 상세에서 "메일 초안 만들기"(템플릿 변수 치환만, AI 생성 없음)
- "발송 완료 처리": 실제 발송 없이 sent_at 기록, 불합격 메일이면 applicants.result_notified_at 갱신 → 보드의 안내 기한 배지가 사라져야 함 (B20)
- 보드의 '불합격 안내' 카드에서 바로 초안 열기

설정 (PEOPLE): settings 4개 값 수정 화면

확인: A0127 이메일 지원서 붙여 넣기 → 중복 지원 배지 → 승인 → P01 보드 서류 칸에 추가되는지. A0082 불합격 메일 발송 완료 처리 → 안내 초과 배지가 사라지는지.
```

---

## 6단계: 배포 (약 20분)

추천: **백엔드 + PostgreSQL = Railway, 프론트 = Vercel** (설정이 가장 적음). 수업에서 다른 곳을 썼다면 그쪽을 따르세요.

```
배포 준비를 해 줘.
- backend: package.json에 build/start:prod, 시작 시 prisma migrate deploy 실행. PORT 환경변수 사용. CORS는 FRONTEND_URL.
- 시드가 비어 있는 DB에서만 돌도록 npm run seed를 안전하게(이미 있으면 건너뜀). data/ 파일 경로가 배포 환경에서도 읽히는지 확인.
- frontend: NEXT_PUBLIC_API_URL 사용, 빌드 에러 없는지 npm run build로 확인.
- README.md: 프로젝트 소개, 데모 계정, 로컬 실행법, 환경변수 이름 목록(값은 쓰지 말 것), 배포 주소 칸.
- git에 .env나 키가 들어가지 않았는지 git grep으로 'sk-' 검사해서 결과 알려 줘.
```

직접 할 일:
1. GitHub에 푸시
2. Railway: New Project → PostgreSQL 추가 → GitHub 저장소 연결(Root Directory `backend`) → 환경변수 `DATABASE_URL`(Postgres 참조), `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBED_MODEL`, `JWT_SECRET`, `FRONTEND_URL` → 배포 후 Railway 셸에서 `npm run seed` → 도메인 생성
3. Vercel: 저장소 Import(Root Directory `frontend`) → `NEXT_PUBLIC_API_URL`=Railway 주소 → 배포 → 나온 주소를 Railway `FRONTEND_URL`에 넣고 재배포
4. 배포 주소에서 데모 계정으로 로그인해 보기
