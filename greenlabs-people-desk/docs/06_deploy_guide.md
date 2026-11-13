# GitHub 푸시와 배포 가이드 (약 25분)

## 1. GitHub에 올리기 (5분)

1. `greenlabs-people-desk.zip`을 내 컴퓨터에 풀기
2. github.com에서 **New repository** 만들기 → 이름 `greenlabs-people-desk` · **Public** · README 추가 체크 **해제** → Create
3. 터미널(또는 Claude Code)에서:

```bash
cd greenlabs-people-desk
git init
git add .
git commit -m "그린랩스 피플 데스크: 채용 보드·평가·일정·통계·규정 질문·지원서 자동 입력"
git branch -M main
git remote add origin https://github.com/<내아이디>/greenlabs-people-desk.git
git push -u origin main
```

4. 푸시 전에 키가 들어가지 않았는지 확인: `git grep -n "sk-"` → **아무것도 안 나와야 함**

## 2. 백엔드 + DB: Railway (10분)

1. railway.app 로그인(GitHub 계정) → **New Project** → **Deploy from GitHub repo** → `greenlabs-people-desk`
2. 만들어진 서비스 → **Settings**
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
3. 프로젝트 화면에서 **+ Create → Database → PostgreSQL** 추가
4. 백엔드 서비스 → **Variables**에 추가

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (자동완성에서 선택) |
| `JWT_SECRET` | 아무 긴 문자열 (예: 키보드로 30자) |
| `OPENAI_API_KEY` | 수업에서 받은 키 (**여기에만** 넣기) |
| `OPENAI_MODEL` | `gpt-4o-mini` (수업에서 안내한 모델이 있으면 그것) |
| `OPENAI_EMBED_MODEL` | `text-embedding-3-small` |
| `DEMO_TODAY` | `2026-11-13` (발표 날짜 기준으로 기한 배지를 고정) |
| `FRONTEND_URL` | 3단계 후 Vercel 주소 (일단 `*`) |

5. **Settings → Networking → Generate Domain** → 주소 복사 (예: `https://xxx.up.railway.app`)
6. 배포가 끝나면 브라우저에서 `https://xxx.up.railway.app/health` → `{"ok":true,"ai":true}` 확인
   - `ai:false`면 `OPENAI_API_KEY` 확인
   - 첫 시작 때 자동으로 테이블을 만들고 가상 데이터를 넣습니다(약 30초). Deploy Logs에 `seed: 완료`가 보이면 정상

## 3. 프론트: Vercel (5분)

1. vercel.com 로그인(GitHub) → **Add New → Project** → `greenlabs-people-desk` Import
2. **Root Directory**: `frontend` (Framework: Next.js 자동 인식)
3. **Environment Variables**: `NEXT_PUBLIC_API_URL` = Railway 주소 (끝에 `/` 없이)
4. Deploy → 나온 주소 복사 (예: `https://greenlabs-people-desk.vercel.app`)
5. Railway로 돌아가 `FRONTEND_URL`을 Vercel 주소로 바꾸면 자동 재배포

## 4. 배포 주소에서 확인 (5분) → 테스트 결과표 ⏳ 칸 채우기

| 시험 | 계정 | 할 일 | 기대 결과 |
|---|---|---|---|
| T23 | 직원 김정규 | "육아휴직 쓰면 연차는 어떻게 돼요?" | 출근 간주라 줄지 않음 + 규정집 제18조 |
| T24 | 직원 김정규 | "재택근무는 주 몇 일까지 돼요?" | 주 2일 (구버전 2026-03-01) |
| T25·T26 | 피플팀 서지원 | 문서 관리 → 규정집 · 개정일 2026-10-01 · `data/rules_2026-10-01_revised.pdf` 올리기 → 같은 질문 | 주 3일 |
| T27 | 직원 | "출장 택시비 한도가 얼마예요?" | 30,000원 + 충돌 안내(경비 지침 40,000원) |
| T28 | 직원 | "야근하고 밤 11시에 택시 타면 지원돼요?" | 50,000원, 경비 지침 제7조 |
| T29 | 직원 한수습 | "수습인데 재택근무 할 수 있어요?" | 입사 1개월 후 주 1일 |
| T32 | 직원 | "재택 통신비는 어떻게 신청해요?" | 피플팀 전달(근거 없음) |
| S04 | 전체 | 로그인·보드·질문 | 동작 |

⚠️ 시연 전에 규정집을 미리 올려 버렸다면 Railway에서 서비스를 재시작해도 데이터는 그대로입니다. 처음 상태로 되돌리려면 Railway 백엔드 서비스의 **셸**에서 `npm run seed:reset`을 실행하세요.

## Railway를 못 쓸 때 (대안: Render)
- render.com → New **PostgreSQL**(Free) 생성 → Internal Database URL 복사
- New **Web Service** → 저장소 연결 → Root Directory `backend`, Build `npm install && npm run build`, Start `npm start`, 환경 변수 위와 동일
- 무료 플랜은 15분 동안 요청이 없으면 잠들어 첫 요청에 50초쯤 걸립니다. **발표 직전에 /health를 한 번 열어 깨워 두세요.**

## 5. 제출 체크리스트 (15:00까지)

- [ ] 고객사: 20. 스타트업 인사팀 "그린랩스 피플팀"
- [ ] 고객 인터뷰 기록: 인터뷰실 "대화 기록 복사" → `docs/00_인터뷰기록.md`로도 커밋
- [ ] 요구사항 정의서 `docs/01` · 기획서 `docs/02` · 기능 명세서 `docs/03` · 테스트 결과표 `docs/04`
- [ ] GitHub 저장소 주소
- [ ] 배포 주소 (프론트 Vercel)
- [ ] 발표 자료
- [ ] README의 배포 주소 칸 채우고 다시 푸시
