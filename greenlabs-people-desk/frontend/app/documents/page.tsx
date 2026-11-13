'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [docType, setDocType] = useState('규정집');
  const [revisedAt, setRevisedAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const load = () => api('/documents').then(setDocs);
  useEffect(() => { load(); }, []);
  const upload = async () => {
    setMsg(null);
    if (!file) return setMsg({ t: 'err', m: 'PDF 파일을 골라 주세요' });
    const f = new FormData(); f.append('file', file); f.append('docType', docType); f.append('revisedAt', revisedAt);
    setBusy(true);
    try { const r = await api('/documents', { form: f }); setMsg({ t: 'ok', m: `올렸습니다: ${r.title} (개정일 ${String(r.revised_at).slice(0, 10)}, ${r.pages}쪽, 조항 ${r.chunks}개). 이전 버전은 보관하고 지금부터 이 문서로 답합니다.` }); load(); }
    catch (e: any) { setMsg({ t: 'err', m: e.message }); }
    setBusy(false);
  };
  return (
    <Shell roles={['PEOPLE']}>
      <h1>문서 관리</h1>
      <p className="desc">규정이 바뀌면 새 파일을 개정일과 함께 올리세요. 올리는 즉시 답변에 반영됩니다. 문서끼리 내용이 다르면 문서 개정일이 더 최근인 문서를 따릅니다. 이전 버전은 지우지 않고 보관하며, 잘못 올렸다면 이전 버전으로 되돌릴 수 있습니다.</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      <div className="card row">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}><option>규정집</option><option>복지 가이드</option><option>경비 지침</option></select>
        <label className="small">개정일(필수) <input type="date" value={revisedAt} onChange={(e) => setRevisedAt(e.target.value)} /></label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="primary" disabled={busy} onClick={upload}>{busy ? '읽는 중…' : '올리기'}</button>
      </div>
      <div className="card">
        <table><thead><tr><th>종류</th><th>문서</th><th>개정일</th><th>버전</th><th>조항 수</th><th>상태</th><th>올린 시각</th></tr></thead><tbody>
          {docs.map((d) => <tr key={d.id}><td>{d.doc_type}</td><td>{d.file_name}</td><td><b>{String(d.revised_at).slice(0, 10)}</b></td><td>v{d.version}</td><td>{d.chunks}</td>
            <td>{d.is_active ? <span className="badge blue">답변에 사용 중</span> : <><span className="small">보관 </span><button onClick={async () => { if (!confirm(`${d.doc_type}을(를) 개정일 ${String(d.revised_at).slice(0, 10)} 버전으로 되돌릴까요? 지금 버전은 보관됩니다.`)) return; try { await api(`/documents/${d.id}/activate`, { body: {} }); setMsg({ t: 'ok', m: '되돌렸습니다. 지금부터 이 버전으로 답합니다.' }); load(); } catch (e: any) { setMsg({ t: 'err', m: e.message }); } }}>이 버전으로 되돌리기</button></>}</td><td className="small">{new Date(d.uploaded_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>)}
        </tbody></table>
      </div>
    </Shell>
  );
}
