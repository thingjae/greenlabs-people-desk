# 기능 명세서 — 그린랩스 피플 데스크

- 스택: Next.js(App Router) · NestJS · PostgreSQL(node-postgres, 시작 시 테이블 자동 생성) · OpenAI API(백엔드에서만 호출)
- 역할: `PEOPLE`(피플팀) · `INTERVIEWER`(면접관) · `EMPLOYEE`(직원)
- 기준 데이터: 가상 자료 6종 (greenlabs_mock_data)

## 1. 화면 목록

| ID | 화면 | 사용자 | 주요 요소 | 요구사항 |
|---|---|---|---|---|
| S0 | 로그인 | 전체 | 데모 계정 버튼(피플팀 2, 면접관 박도현·이서준·한지민·송유나, 직원 정규직·수습) | 권한 |
| S1 | **채용 보드** | 피플팀(전체), 면접관(배정 포지션만) | 포지션 탭, 단계별 칸(서류~입사, 종료: 불합격·중도 이탈), 카드에 **다음 할 일·다음 담당자**, 배지: `안내 기한 D-n/초과`, `과제 기한 초과`, `평가 미제출`, `중복 지원`, `확인 필요`. 상단 요약: 오늘 할 일 수 | R1 R2 R11 R16 R17 |
| S2 | 지원자 상세 | 피플팀, 면접관(배정 포지션) | 기본 정보, 단계 이력, 평가 목록, 면접 일정, 메일 기록. 피플팀만: 단계 이동·불합격·중도 이탈 버튼, **연봉(처우) 칸**, **같은 이메일 지원 기록** | R1 R10 R13 |
| S3 | 지원서 등록 대기 | 피플팀 | 지원서 메일 본문 붙여 넣기 → AI 추출 결과(이름·이메일·연락처·지원 경로·포지션, 확신 낮은 칸 노란색) 수정 → 중복 표시 → 승인/반려 | R12 R13 |
| S4 | 면접 일정 | 면접관: 가능 시간 입력 / 피플팀: 확정 | 면접관: 날짜·시간 칸 선택 저장. 피플팀: 지원자·단계 선택 → 배정 면접관 **모두 가능한 시간** 목록 → 확정 → 확정 메일 초안 | R4 |
| S5 | 평가 입력 | 면접관 | 포지션·단계의 기준표(항목·설명·가중치·척도별 기준), 항목별 점수(척도 범위 검증)·근거, 종합 의견(합격/보류/불합격), 제출. 제출 전 다른 면접관 평가는 "제출 후 공개" | R3 |
| S6 | 통계 | 피플팀 | 포지션별 지원자 수, 단계별 **앞 단계 대비 통과율**(기본)·전체 대비(보조), 채용 사이트별 지원 수·서류 통과율·면접 진출 수·입사 수, 불합격과 중도 이탈 분리 | R9 |
| S7 | 메일 | 피플팀 | 템플릿 5종(접수·과제·면접 일정·합격·불합격) 편집, 초안 목록, "발송 완료 처리"(실제 발송 없음, 발송일 기록) | R14 R11 |
| S8 | **직원 질문** | 전체 | 채팅. 답변 아래 근거 카드(문서명·개정일·조항·쪽·원문 일부), 충돌 시 "다른 문서에는 ○○로 적혀 있으나 개정일이 더 최근인 △△를 따름", 이관 시 "피플팀이 직접 답드립니다" | R5 R7 R8 |
| S9 | 문서 관리 | 피플팀 | PDF 업로드(문서 종류·**개정일 필수**), 버전 목록, 현재 적용 버전 표시 | R6 |
| S10 | 문의함 | 피플팀 | 질문·답변 기록, 이관된 질문(민감/근거 없음) 목록과 처리 완료 표시. 민감 질문은 피플팀만 열람 | R8 R18 |
| S11 | 설정 | 피플팀 | 불합격 안내 기한(5영업일), 평가 제출 기한(2영업일), 면접 길이(60분), 불합격자 보관 기간(180일) | 5-3 기본값 |

## 2. 데이터 설계

### 2-1. 테이블

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `users` | id, name, email, password_hash, role(`PEOPLE`/`INTERVIEWER`/`EMPLOYEE`), employment_type(`정규직`/`수습`/`계약직`/`인턴`) | 데모 계정 시드 |
| `positions` | id(`P01`…), name, department, headcount, opened_at, has_task, interview_minutes, status | 6건 |
| `position_interviewers` | position_id, user_id, stage(`FIRST`/`SECOND`) | **열람 권한의 기준** |
| `applicants` | id, position_id, name, email, phone, source, applied_at, stage, status(`진행 중`/`입사 확정`/`불합격`/`중도 이탈`/null), end_stage, end_reason, stage_changed_at, task_due_at, task_submitted_at, result_notified_at, salary_offer, needs_review, review_note | 400건 + 등록분. `salary_offer`는 피플팀 응답에만 포함 |
| `stage_histories` | id, applicant_id, from_stage, to_stage, changed_by, changed_at, reason | 모든 단계 변경 기록 |
| `eval_criteria` | id, position_id, stage, item, description, weight, scale_min, scale_max, scale_labels(json) | 평가표 엑셀 시드 |
| `evaluations` | id, applicant_id, interviewer_id, stage, scores(json: item_id→점수·근거), verdict, submitted_at, due_at | 지원자·면접관·단계당 1건 |
| `evaluation_revisions` | id, evaluation_id, before(json), edited_by, edited_at | 제출 후 수정 이력 |
| `availabilities` | id, interviewer_id, start_at, end_at | 면접관 가능 시간 |
| `interviews` | id, applicant_id, stage, start_at, end_at, interviewer_ids(json), confirmed_by, confirmed_at | |
| `intake_drafts` | id, raw_text, extracted(json), low_confidence_fields(json), duplicate_ids(json), suspect_ids(json), status(`대기`/`승인`/`반려`), decided_by, decided_at, applicant_id | AI 추출 결과 |
| `email_templates` | id, type, subject, body(변수 `{{이름}}` `{{포지션}}` `{{일시}}`) | 5종 |
| `email_logs` | id, applicant_id, type, subject, body, status(`초안`/`발송 완료`), created_by, sent_at | |
| `documents` | id, doc_type(`규정집`/`복지 가이드`/`경비 지침`), title, revised_at, file_name, version, is_active, uploaded_by, uploaded_at | 종류별 활성 문서 1개 |
| `doc_chunks` | id, document_id, page, article, text, embedding(float8[]) | 조항 단위로 자름 |
| `qa_logs` | id, user_id, question, answer, citations(json), conflict(json), status(`답변`/`이관`), escalation_reason(`민감`/`근거 없음`), is_sensitive, resolved_at | |
| `settings` | key, value | S11 값 |

### 2-2. 관계
- `positions` 1—N `applicants`, `positions` N—N `users`(via `position_interviewers`)
- `applicants` 1—N `stage_histories`, `evaluations`, `interviews`, `email_logs`
- `evaluations` 1—N `evaluation_revisions`
- `documents` 1—N `doc_chunks`
- `users` 1—N `qa_logs`, `availabilities`

## 3. 규칙과 지키는 곳

모든 규칙은 **백엔드(NestJS 서비스·가드)**에서 지킵니다. 화면은 숨기기만 하고 신뢰하지 않습니다.

| ID | 규칙 | 지키는 곳 |
|---|---|---|
| B1 | 면접관은 `position_interviewers`에 배정된 포지션의 지원자만 조회 가능. 그 외 요청은 403 | `ApplicantAccessGuard` + 목록 쿼리의 where 조건 |
| B2 | `salary_offer`, 같은 이메일 지원 기록, 단계 이력의 사유는 `PEOPLE`에게만 응답 | `ApplicantsService` 응답 직렬화 |
| B3 | 단계 이동·불합격·중도 이탈은 `PEOPLE`만. 순서는 서류→과제(과제 있는 포지션만)→1차→2차→처우 협의→입사. 불합격·중도 이탈은 `end_stage`에 현재 단계를 기록. 중도 이탈은 사유(지원 취소/처우 결렬/입사 포기/과제 미제출) 필수 | `@Roles(PEOPLE)` + `StageService.transition()` |
| B4 | 불합격 확정 시 `안내 기한 = 결정일 + 5영업일`(주말 제외, 설정값). 오늘 기준 1영업일 이하 남으면 `D-1`, 넘으면 `초과` 배지 | `DeadlineService` (보드 조회 시 계산) |
| B5 | 과제 마감일이 지났는데 제출일이 없으면 `과제 기한 초과` 배지만 표시. **자동 불합격 금지** | 보드 조회 계산 |
| B6 | 면접관 본인의 해당 단계 평가가 `submitted_at` 없으면, 같은 지원자의 다른 면접관 평가를 응답하지 않음 | `EvaluationsService.findForApplicant()` |
| B7 | 점수는 해당 항목의 `scale_min~scale_max` 범위만 허용(P05 1~4, P06 1~3) | DTO 검증 + 서비스 |
| B8 | 제출 후 수정 시 이전 값을 `evaluation_revisions`에 저장 | `EvaluationsService.update()` |
| B9 | 면접 일정 확정은 배정 면접관 **모두**의 가능 시간에 들어가는 구간만 허용 | `InterviewsService.confirm()` |
| B10 | 지원서 자동 입력 결과는 `intake_drafts`에만 저장. `PEOPLE`이 승인해야 `applicants` 생성. 지원 경로·이메일·포지션은 필수 | `IntakeService.approve()` |
| B11 | 중복 판단: 이메일 완전 일치 → `중복 지원`, 이름+연락처(숫자만 비교) 일치·이메일 다름 → `중복 의심`(자동 병합 금지) | `DuplicateService` |
| B12 | 연락처는 저장 시 `010-0000-0000` 형식으로 맞춤 | 가져오기·승인 시 정규화 |
| B13 | 가져오기 시 현재 단계 또는 지원 경로가 비면 `needs_review=true`, `review_note`에 사유 | `ImportService` |
| B14 | 문서 업로드 시 개정일 필수. 같은 종류의 이전 문서는 `is_active=false`로 보관(삭제 안 함). 답변 검색은 활성 문서만 | `DocumentsService.upload()` |
| B15 | 두 문서의 근거가 서로 다르면 **문서 `revised_at`이 최신인 문서**를 채택하고 다른 문서 내용을 `conflict`에 함께 기록 (고객 확정 F4) | `QaService` 프롬프트 + 후처리 |
| B16 | 민감 질문(건강·질병·가족 사정·징계·괴롭힘·성희롱·급여 개인 정보)은 1단계 키워드 검사에서 걸리면 AI를 호출하지 않고, 키워드에 안 걸려도 AI가 민감으로 판단하면 답변을 버리고 `이관` 처리 | `SupportController.ask` |
| B17 | 검색 결과가 질문과 관련 없거나 AI가 근거를 찾지 못하면 `이관`(근거 없음). 근거 없는 답변 금지 | `QaService` |
| B18 | 민감 질문의 `qa_logs`는 `PEOPLE`과 질문한 본인만 조회 | `QaLogsController` |
| B19 | 통과율: 단계 k의 앞 단계 대비 = (k 이후 단계에 도달한 수) ÷ (k-1 단계에 도달한 수). 도달 = 현재 단계가 그 단계 이상이거나 `end_stage`가 그 단계 이상. 과제 없는 포지션은 과제 단계 제외. 단계 누락 행은 분모에서 제외하고 건수를 따로 표시 | `StatsService` |
| B20 | 메일은 실제 발송하지 않음. "발송 완료 처리" 시 `sent_at` 기록, 불합격이면 `applicants.result_notified_at` 갱신 | `EmailService` |

## 4. 권한

| 기능 / API | PEOPLE | INTERVIEWER | EMPLOYEE |
|---|---|---|---|
| 보드·지원자 목록 `GET /applicants` | 전체 | 배정 포지션만 (B1) | ✕ |
| 지원자 상세 `GET /applicants/:id` | 전체(연봉·중복 포함) | 배정 포지션만, 연봉·중복 제외 (B2) | ✕ |
| 단계 변경 `POST /applicants/:id/transition` | ○ | ✕ | ✕ |
| 지원서 자동 입력 `/intake/*` | ○ | ✕ | ✕ |
| 평가 작성 `POST /evaluations` | 조회만 | 배정 포지션·단계만 | ✕ |
| 가능 시간 `/availabilities` | 조회 | 본인 것만 입력 | ✕ |
| 일정 확정 `POST /interviews` | ○ | 조회 | ✕ |
| 통계 `/stats` | ○ | ✕ | ✕ |
| 메일 `/emails`, `/templates` | ○ | ✕ | ✕ |
| 문서 업로드 `/documents` | ○ | 조회 | 조회 |
| 질문하기 `POST /qa/ask` | ○ | ○ | ○ |
| 문의함 `GET /qa/logs` | 전체 | 본인 것 | 본인 것 |
| 설정 `/settings` | ○ | ✕ | ✕ |

인증: 이메일+비밀번호 로그인 → JWT(역할·user_id 포함). 모든 API에 `JwtAuthGuard` + `RolesGuard`.

## 5. AI가 맡을 일

| ID | 일 | 입력 | 출력 | 안전장치 |
|---|---|---|---|---|
| AI-1 | **직원 질문 답변** | 질문, 활성 문서의 관련 조항 상위 6개(임베딩 유사도) + 각 조항의 문서명·개정일·조항·쪽 | JSON `{answer, citations:[{doc,revised_at,article,page,quote}], conflict:{other_doc,other_value,chosen_doc,reason}|null, grounded:boolean, applies_to}` | 1) 민감 분류 먼저(키워드 + LLM) → 이관 2) 제공된 조항 밖 내용으로 답하지 말 것 3) `grounded=false`면 이관 4) 충돌 시 B15 규칙을 프롬프트에 명시하고 서버에서 `revised_at` 비교로 재확인 5) 고용 형태별 차이가 있으면 `applies_to` 표시 |
| AI-2 | **지원서 항목 추출** | 지원서 메일 본문(붙여 넣기) + 포지션 목록 + 지원 경로 목록 | JSON `{name,email,phone,source,position_id,applied_at,low_confidence:[필드]}` | 결과는 등록 대기에만(B10), 연락처 정규화(B12), 중복 검사(B11), 모르는 값은 비워 둠 |
| AI-3 | 메일 초안 | 템플릿 + 지원자·일정 변수 | 제목·본문 | 템플릿 치환만 사용(AI 문장 생성 없음 → 일관성). 피플팀 확인 후 발송 처리 |

- 모델과 키는 백엔드 환경 변수(`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBED_MODEL`)에만 둠
- 임베딩은 문서 업로드 시 1회 계산해 `doc_chunks.embedding`에 저장(공용 키 사용량 절약)
- 실패 시: 질문 답변은 "지금 답변할 수 없어 피플팀에 전달했습니다"로 이관, 추출은 빈 양식으로 대기 목록에 넣음

## 6. 시드 데이터
- 지원자 400명·포지션 6개: `positions_applicants.xlsx`
- 평가 기준표: `interview_eval_criteria.xlsx`
- 문서: 시작 시 **규정집 구버전(2026-03-01)**, 복지 가이드(2026-01-02), 경비 지침(2026-07-01)을 활성화. 개정판(2026-10-01)은 시연 중 업로드
- 데모 계정: 피플팀 2(+예비 1), 면접관 4(박도현: P01·P02·P04 2차 / 이서준·한지민: P01 1차 / 송유나: P03 2차), 직원 2(정규직 1, 수습 1). 비밀번호 demo1234
- AI 키가 없거나 호출이 실패하면: 질문 답변은 키워드 검색 결과만 근거로 보여 주거나 이관, 지원서 추출은 정규식 추출만 사용
