'use client';
import { useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

const EXAMPLES = ['재택근무는 주 몇 일까지 돼요?', '출장 택시비 한도가 얼마예요?', '육아휴직 쓰면 연차는 어떻게 돼요?', '수습인데 재택근무 할 수 있어요?', '야근하고 밤 11시에 택시 타면 지원돼요?', '재택 통신비는 어떻게 신청해요?', '아이가 아파서 병원에 가야 하는데 병가 쓰면 되나요?'];

export default function Ask() {
  const me = typeof window !== 'undefined' ? getMe() : null;
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setText('');
    setItems((x) => [...x, { me: true, text: question }]);
    try { const r = await api('/qa/ask', { body: { question } }); setItems((x) => [...x, r]); }
    catch (e: any) { setItems((x) => [...x, { status: '오류', message: e.message }]); }
    setBusy(false);
  };
  return (
    <Shell>
      <h1>규정 질문</h1>
      <p className="desc">휴가, 복지, 경비, 재택근무를 물어보세요. 사내 문서를 근거로 답하고 근거 위치(문서·조항·쪽)를 보여 줍니다.{me?.employmentType ? ` 질문자 고용 형태: ${me.employmentType}` : ''}</p>
      <div className="chips">{EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => ask(e)}>{e}</button>)}</div>
      <div className="chat card">
        {items.length === 0 && <p className="small">예시 질문을 누르거나 직접 입력하세요. 건강·가족·징계 등 개인 사정이 담긴 질문은 피플팀이 직접 답합니다.</p>}
        {items.map((it, i) => it.me ? <div key={i} className="bubble me">{it.text}</div> : (
          <div key={i} className="bubble bot">
            {it.status === '답변' ? (
              <>
                <div>{it.answer}</div>
                {it.appliesTo && <div className="small" style={{ marginTop: 4 }}>적용 대상: {it.appliesTo}</div>}
                {it.conflict && (
                  <div className="conflict">⚠️ 문서끼리 내용이 다릅니다. <b>{it.conflict.other_doc}</b>({it.conflict.other_revised_at})에는 "{it.conflict.other_value}"로 적혀 있지만, 문서 개정일이 더 최근인 <b>{it.conflict.chosen_doc}</b>({it.conflict.chosen_revised_at})를 따릅니다.</div>
                )}
                {(it.citations || []).map((c: any, j: number) => (
                  <div key={j} className="cite"><b>{c.doc}</b> (개정일 {c.revisedAt}) · {c.article} · {c.page}쪽<div className="small">"{c.quote}…"</div></div>
                ))}
              </>
            ) : (
              <div>
                <span className={`badge ${it.escalationReason === '민감' ? 'orange' : 'yellow'}`}>피플팀 전달 · {it.escalationReason || it.status}</span>
                <div style={{ marginTop: 4 }}>{it.message}</div>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble bot small">문서를 찾는 중…</div>}
      </div>
      <div className="row">
        <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask(text)} placeholder="질문을 입력하세요" />
        <button className="primary" onClick={() => ask(text)} disabled={busy}>질문</button>
      </div>
    </Shell>
  );
}
