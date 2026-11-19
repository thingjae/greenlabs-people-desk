import Link from 'next/link';

const TBC = () => <span className="tbc">확인 필요</span>;

const FEATURES = [
  {
    no: '01', title: '지원서 자동 입력', img: '/sales/intake.jpg', demo: 'intake',
    doing: '채용 사이트에서 온 지원서 메일 본문을 붙여 넣고, 채워진 값을 확인합니다.',
    change: '옮겨 적는 대신 확인만 합니다. 같은 이메일로 지원한 적이 있으면 바로 알려 줍니다. 승인 전에는 지원자로 등록되지 않습니다.',
    proof: '가상 지원서에서 이름·이메일·연락처·포지션·지원 경로·지원일 6개 항목 추출, 중복 지원 표시, 승인 후 보드 등록을 배포 주소에서 확인',
  },
  {
    no: '02', title: '채용 보드', img: '/sales/board.jpg', demo: 'notice',
    doing: '포지션 탭을 열고, "안내 기한 초과" 같은 칩을 눌러 걸러 봅니다.',
    change: '메일을 뒤지지 않아도 지원자마다 다음 할 일과 담당자가 보입니다. 불합격 안내 5영업일 기한이 다가오면 배지로 알려 줍니다.',
    proof: '가상 지원자 400명에서 안내 기한 초과 7건, 과제 기한 초과 6건, 확인 필요 17건을 정확히 표시',
  },
  {
    no: '03', title: '규정 질문 답변', img: '/sales/ask.jpg', demo: 'ask', imgNote: '개인 사정이 담긴 질문은 자동으로 답하지 않고 피플팀에 넘깁니다',
    doing: '직원은 웹에서 질문하고, 피플팀은 규정이 바뀌면 새 PDF를 개정일과 함께 올립니다.',
    change: '답마다 문서·조항·쪽 근거가 붙습니다. 문서끼리 내용이 다르면 개정일이 최신인 문서를 따르고 차이를 알립니다. 개인 사정이 담긴 질문은 사람이 답합니다.',
    proof: '규정집 개정판을 올리자 "재택근무 주 2일" 답이 "주 3일"로 바뀌는 것을 배포 주소에서 확인',
  },
];

export default function Sales() {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <span className="lp-logo">그린랩스 피플 데스크 <span className="ver">v1.0</span></span>
        <span style={{ marginLeft: 'auto' }} />
        <Link href="/login">직원 로그인</Link>
        <Link href="/demo" className="lp-btn sm">로그인 없이 체험</Link>
      </nav>

      <header className="lp-hero">
        <div className="lp-kicker">스타트업 피플팀을 위한 채용·규정 데스크</div>
        <h1 className="lp-h1">6개 포지션 채용과 하루 20건의 규정 문의를 맡은 피플팀 매니저가 지원서를 옮겨 적다 <em>면접 확정 메일을 놓치는 월요일 아침</em>을 줄입니다.</h1>
        <p className="lp-lead">채용 사이트마다 형식이 다른 지원서는 붙여 넣으면 AI가 채우고, 사람이 확인해서 등록합니다. 지원자마다 다음 할 일이 보이고, 직원 질문에는 사내 문서를 근거로 답합니다.</p>
        <div className="row" style={{ gap: 12 }}>
          <Link href="/demo" className="lp-btn">로그인 없이 3분 체험하기 →</Link>
          <a href="#how" className="lp-btn ghost">어떻게 달라지나요</a>
        </div>
        <div className="small" style={{ marginTop: 10 }}>회원가입 없음 · 모든 데이터는 가상 · 메일은 실제로 보내지 않음</div>
      </header>

      <section className="lp-sec" id="how">
        <h2 className="lp-h2">업무 순서가 이렇게 바뀝니다</h2>
        <table className="lp-table"><thead><tr><th>업무</th><th>지금</th><th>피플 데스크에서</th></tr></thead><tbody>
          <tr><td>지원서 등록</td><td>메일 열기 → 사이트별 형식 읽기 → 스프레드시트에 옮겨 적기 → 중복은 기억에 의존</td><td>본문 붙여 넣기 → AI가 항목 채움 + 같은 이메일 지원 표시 → <b>피플팀이 확인하고 등록</b></td></tr>
          <tr><td>진행 확인</td><td>메일함을 뒤져 지원자별 상태 확인</td><td>보드 카드에 <b>다음 할 일 · 담당자</b>, 기한 배지</td></tr>
          <tr><td>면접 일정</td><td>면접관 세 명과 메일로 시간 맞추기</td><td>면접관이 가능 시간 입력 → <b>모두 가능한 시간</b>만 골라 확정</td></tr>
          <tr><td>불합격 안내</td><td>매번 새로 작성, 5영업일 원칙을 놓치기도 함</td><td>기한 배지 → 템플릿 초안 → 확인 후 발송, 발송 기록</td></tr>
          <tr><td>규정 문의</td><td>슬랙 질문 → 규정집·지침을 찾아 답</td><td>웹에서 질문 → <b>근거와 함께</b> 답, 개인 사정·근거 없는 질문은 피플팀으로</td></tr>
        </tbody></table>
      </section>

      <section className="lp-sec">
        <h2 className="lp-h2">주요 기능</h2>
        {FEATURES.map((f) => (
          <div key={f.no} className="lp-feat">
            <div>
              <div className="lp-no">{f.no}</div>
              <h3>{f.title}</h3>
              <dl>
                <dt>사용자가 하는 일</dt><dd>{f.doing}</dd>
                <dt>달라지는 점</dt><dd>{f.change}</dd>
                <dt>보여줄 근거</dt><dd>{f.proof}</dd>
              </dl>
              <Link href={`/demo#${f.demo}`} className="lp-link">이 기능 체험하기 →</Link>
            </div>
            <figure><img src={f.img} alt={`${f.title} 화면`} />{f.imgNote && <figcaption>{f.imgNote}</figcaption>}</figure>
          </div>
        ))}
        <p className="small">그 밖에: 면접 평가(본인 제출 전 다른 면접관 평가 잠금) · 면접 일정 · 채용 통계 · 메일 템플릿 5종 · 포지션 단위 열람 권한 · 문서 이전 버전 되돌리기</p>
      </section>

      <section className="lp-sec lp-grid2">
        <div className="lp-box">
          <h3>언제든 멈추거나 고칠 수 있습니다</h3>
          <ul>
            <li>AI가 채운 지원서 값은 <b>승인 전까지 고치거나 반려</b></li>
            <li>단계 이동과 불합격 확정은 <b>피플팀 버튼으로만</b></li>
            <li>불합격 메일은 <b>초안을 고친 뒤</b> 발송 처리</li>
            <li>개인 사정·근거 없는 질문은 <b>자동으로 답하지 않음</b></li>
            <li>잘못 올린 규정 문서는 <b>이전 버전으로 되돌리기</b></li>
          </ul>
        </div>
        <div className="lp-box">
          <h3>도입에 필요한 것</h3>
          <ul>
            <li><b>자료</b>: 규정 PDF와 개정일, 지원자 목록 엑셀, 포지션별 평가 기준표, 면접관 배정표</li>
            <li><b>권한</b>: 피플팀 계정, 면접관-포지션 배정. 사내 로그인(SSO) 연동 <TBC /></li>
            <li><b>지원 범위</b>: 웹 화면, 데이터 1회 이관, 기준값(안내 기한·보관 기간 등) 설정</li>
            <li><b>포함하지 않음</b>: 메일함 자동 수집, 실제 메일 발송, 슬랙, 온보딩 요청</li>
          </ul>
        </div>
        <div className="lp-box">
          <h3>근거</h3>
          <ul>
            <li><b>직접 확인</b>: 시험 56개 중 통과 54 · 부분 통과 1 · 실패 0 (가상 데이터) / 배포 주소에서 첫 방문 → AI 등록 → 다시 찾기 → 초기화 (2026-11-19)</li>
            <li><b>아직 확인 못 함</b>: 실제 채용 사이트 메일 원문 · 실제 규정 150쪽 규모 · 여러 명 동시 사용</li>
            <li><b>도입 후 함께 잴 것</b>: 지원서 1건 등록 시간 · 진행 확인용 메일 검색 횟수 · 안내 5영업일 준수율 · 일정 확정까지 메일 왕복 수 · 자동 답변/피플팀 전달 비율</li>
          </ul>
        </div>
        <div className="lp-box">
          <h3>담당과 비용</h3>
          <ul>
            <li>제작·기술 지원: 정명재 (연락처 <TBC />)</li>
            <li>고객 측 운영 담당(문서 업로드·기준값 관리): <TBC /></li>
            <li>비용 항목: AI 사용료(OpenAI, 사용량 과금) · 서버·DB(Railway) · 화면(Vercel). 금액과 부담 주체 <TBC /></li>
          </ul>
          <h3 style={{ marginTop: 12 }}>현재 한계</h3>
          <ul className="small">
            <li>지원서는 붙여 넣기 방식(한 번에 최대 10건)</li>
            <li>영업일 계산에 공휴일 미반영 · 평가 기준표 편집 화면 없음</li>
            <li>AI는 올린 문서 안의 내용으로만 답함</li>
          </ul>
        </div>
      </section>

      <section className="lp-cta">
        <h2>회원가입 없이 지금 바로 해 보세요</h2>
        <p>지원서 한 건을 등록하고 보드에서 다시 찾기까지 약 3분입니다.</p>
        <Link href="/demo" className="lp-btn light">로그인 없이 체험하기 →</Link>
      </section>
      <footer className="lp-foot">그린랩스 피플 데스크 v1.0 · FDE 빌더 해커톤 결과물 · 모든 인물·문서·지원자는 가상 데이터입니다</footer>
    </div>
  );
}
