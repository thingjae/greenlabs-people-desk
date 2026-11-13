'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getMe } from '@/lib/api';

export default function Inbox() {
  const me = typeof window !== 'undefined' ? getMe() : null;
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState('이관');
  const [reply, setReply] = useState<Record<number, string>>({});
  const load = () => api('/qa/logs').then(setRows);
  useEffect(() => { load(); }, []);
  const list = rows.filter((r) => tab === '전체' || r.status === tab);
  return (
    <Shell roles={['PEOPLE', 'EMPLOYEE']}>
      <h1>{me?.role === 'PEOPLE' ? '문의함' : '내 문의'}</h1>
      <p className="desc">{me?.role === 'PEOPLE' ? '자동으로 답하지 않고 넘어온 질문(민감·근거 없음)을 처리하고, 시스템이 한 답변을 확인합니다. 민감한 질문은 피플팀만 볼 수 있습니다.' : '내가 한 질문과 처리 상태입니다.'}</p>
      <div className="tabs">{['이관', '답변', '전체'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === '이관' ? '피플팀 전달' : t === '답변' ? '자동 답변' : '전체'} ({rows.filter((r) => t === '전체' || r.status === t).length})</button>)}</div>
      <div className="card">
        <table><thead><tr><th>시각</th>{me?.role === 'PEOPLE' && <th>질문자</th>}<th>질문</th><th>결과</th><th>근거</th>{me?.role === 'PEOPLE' && <th></th>}</tr></thead><tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td className="small">{new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
              {me?.role === 'PEOPLE' && <td>{r.user_name}<div className="small">{r.employment_type}</div></td>}
              <td>{r.question}</td>
              <td>{r.status === '이관' && <span className={`badge ${r.escalation_reason === '민감' ? 'orange' : 'yellow'}`}>{r.escalation_reason}</span>}{r.answer && <div className="small" style={{ marginTop: 4 }}>{r.answer}</div>}{r.status === '이관' && !r.resolved_at && me?.role !== 'PEOPLE' && <div className="small">피플팀이 확인 중입니다</div>}{r.resolved_at && <span className="badge blue">처리 완료</span>}</td>
              <td className="small">{(r.citations || []).map((c: any) => `${c.doc} ${c.article} ${c.page}쪽`).join(' / ')}</td>
              {me?.role === 'PEOPLE' && <td style={{ minWidth: 220 }}>{!r.resolved_at && r.status === '이관' && <><textarea rows={2} placeholder="직원에게 보낼 답변 (비워 두면 처리 완료만)" value={reply[r.id] || ''} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} /><button onClick={async () => { await api(`/qa/logs/${r.id}/resolve`, { body: { answer: reply[r.id] || '' } }); load(); }}>답변하고 처리 완료</button></>}</td>}
            </tr>
          ))}
        </tbody></table>
        {list.length === 0 && <p className="small">없습니다.</p>}
      </div>
    </Shell>
  );
}
