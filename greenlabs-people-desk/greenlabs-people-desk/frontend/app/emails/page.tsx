'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function Emails() {
  const [tpl, setTpl] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const load = async () => { setTpl(await api('/templates')); setLogs(await api('/emails')); };
  useEffect(() => { load(); }, []);
  const save = async (t: any) => { await api(`/templates/${t.id}`, { method: 'PUT', body: { subject: t.subject, body: t.body } }); setMsg(`${t.type} 템플릿을 저장했습니다`); };
  return (
    <Shell roles={['PEOPLE']}>
      <h1>메일</h1>
      <p className="desc">지원자에게 보내는 메일 5종을 템플릿으로 관리합니다. 지원자 상세에서 초안을 만들고, 확인한 뒤 발송 완료로 처리합니다. 변수: {'{{이름}} {{포지션}} {{일시}}'}</p>
      {msg && <div className="ok">{msg}</div>}
      <div className="card">
        <h3>초안·발송 기록</h3>
        <table><thead><tr><th>종류</th><th>지원자</th><th>제목</th><th>상태</th></tr></thead><tbody>
          {logs.map((l) => <tr key={l.id}><td>{l.type}</td><td><a href={`/applicants/${l.applicant_id}`}>{l.applicant_name} ({l.applicant_id})</a></td><td>{l.subject}</td><td>{l.status === '발송 완료' ? <span className="badge blue">발송 완료</span> : <span className="badge yellow">초안</span>}</td></tr>)}
        </tbody></table>
        {logs.length === 0 && <p className="small">아직 없습니다.</p>}
      </div>
      {tpl.map((t, i) => (
        <div className="card" key={t.id}>
          <h3>{t.type}</h3>
          <input style={{ width: '100%', marginBottom: 6 }} value={t.subject} onChange={(e) => { const x = [...tpl]; x[i] = { ...t, subject: e.target.value }; setTpl(x); }} />
          <textarea rows={5} value={t.body} onChange={(e) => { const x = [...tpl]; x[i] = { ...t, body: e.target.value }; setTpl(x); }} />
          <button style={{ marginTop: 6 }} onClick={() => save(t)}>저장</button>
        </div>
      ))}
    </Shell>
  );
}
