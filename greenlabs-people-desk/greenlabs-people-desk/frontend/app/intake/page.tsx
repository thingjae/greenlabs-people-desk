'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

const SOURCES = ['사람인', '원티드', '잡코리아', '리멤버', '로켓펀치', '사내 추천', '회사 채용 페이지'];
const SAMPLE_WANTED = `[원티드] 새로운 지원자가 있습니다
포지션: 백엔드 개발자
지원자: 정다온
이메일: daon.jung@example.com
연락처: 010-0000-7781
지원일: 2026.11.13
첨부: 이력서_정다온.pdf, 포트폴리오 링크`;
const SAMPLE_SARAMIN = `사람인 입사지원 알림
그린랩스 「프론트엔드 개발자」 공고에 입사지원이 접수되었습니다.
성명 : 윤하람 / 휴대폰 01000007790 / E-mail haram.y@example.net
접수일시 2026-11-12 22:41`;

export default function Intake() {
  const [raw, setRaw] = useState('');
  const [drafts, setDrafts] = useState<any[]>([]);
  const [edit, setEdit] = useState<Record<number, any>>({});
  const [positions, setPositions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const load = () => api('/intake').then(setDrafts);
  useEffect(() => { load(); api('/positions').then(setPositions); }, []);
  const dupSample = async () => {
    const a = await api('/applicants/A0127');
    setRaw(`잡코리아 지원 알림\n지원 포지션: 데이터 엔지니어\n이름: ${a.applicant.name}\n이메일: ${a.applicant.email}\n연락처: ${a.applicant.phone}\n지원일: 2026-11-13`);
  };
  const extract = async () => {
    setMsg(null); setBusy(true);
    try { const r = await api('/intake/extract', { body: { rawText: raw } }); setMsg({ t: 'ok', m: `${r.length}건을 등록 대기에 넣었습니다. 내용을 확인하고 승인하세요.` }); setRaw(''); load(); }
    catch (e: any) { setMsg({ t: 'err', m: e.message }); }
    setBusy(false);
  };
  const val = (d: any, k: string) => (edit[d.id]?.[k] ?? d.extracted[k] ?? '');
  const set = (d: any, k: string, v: string) => setEdit({ ...edit, [d.id]: { ...(edit[d.id] || {}), [k]: v } });
  const approve = async (d: any) => {
    setMsg(null);
    try { const r = await api(`/intake/${d.id}/approve`, { body: edit[d.id] || {} }); setMsg({ t: 'ok', m: `승인했습니다. 지원자 ${r.applicantId}로 서류 단계에 등록했습니다.` }); load(); }
    catch (e: any) { setMsg({ t: 'err', m: e.message }); }
  };
  const low = (d: any, k: string) => (d.low_confidence || []).includes(k) ? 'low' : '';
  return (
    <Shell roles={['PEOPLE']}>
      <h1>지원서 등록 대기</h1>
      <p className="desc">채용 사이트에서 온 지원서 메일 내용을 붙여 넣으면 AI가 항목을 채웁니다. 사이트마다 형식이 달라서, 피플팀이 확인하고 승인해야 지원자로 등록됩니다. 여러 건은 --- 줄로 구분하세요.</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="small">예시:</span>
          <button onClick={() => setRaw(SAMPLE_WANTED)}>원티드 형식</button>
          <button onClick={() => setRaw(SAMPLE_SARAMIN)}>사람인 형식</button>
          <button onClick={dupSample}>이미 지원한 사람(A0127)</button>
          <button onClick={() => setRaw(SAMPLE_WANTED + '\n---\n' + SAMPLE_SARAMIN)}>2건 한 번에</button>
        </div>
        <textarea rows={7} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="지원서 메일 본문을 붙여 넣으세요" />
        <button className="primary" style={{ marginTop: 6 }} disabled={busy || !raw.trim()} onClick={extract}>{busy ? 'AI가 읽는 중…' : '항목 채우기'}</button>
      </div>
      <h3>확인 대기 {drafts.length}건</h3>
      {drafts.map((d) => (
        <div className="card" key={d.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              {(d.duplicate_ids || []).length > 0 && <span className="badge blue">중복 지원 — 같은 이메일: {(d.duplicate_ids || []).map((x: string) => <a key={x} href={`/applicants/${x}`} style={{ textDecoration: 'underline', marginRight: 4 }}>{x}</a>)}</span>}
              {(d.suspect_ids || []).length > 0 && <span className="badge blue">중복 의심 (이름·연락처 같음): {(d.suspect_ids || []).join(', ')}</span>}
              {(d.low_confidence || []).length > 0 && <span className="badge yellow">노란 칸을 확인하세요</span>}
            </div>
            <span className="small">{new Date(d.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
          </div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <pre className="small" style={{ whiteSpace: 'pre-wrap', background: '#fafbfa', padding: 8, borderRadius: 8, margin: 0 }}>{d.raw_text}</pre>
            <div className="kv">
              <div>이름*</div><input className={low(d, 'name')} value={val(d, 'name')} onChange={(e) => set(d, 'name', e.target.value)} />
              <div>이메일*</div><input className={low(d, 'email')} value={val(d, 'email')} onChange={(e) => set(d, 'email', e.target.value)} />
              <div>연락처</div><input className={low(d, 'phone')} value={val(d, 'phone')} onChange={(e) => set(d, 'phone', e.target.value)} />
              <div>포지션*</div><select className={low(d, 'position_id')} value={val(d, 'position_id')} onChange={(e) => set(d, 'position_id', e.target.value)}><option value="">선택</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.id} {p.name}</option>)}</select>
              <div>지원 경로*</div><select className={low(d, 'source')} value={val(d, 'source')} onChange={(e) => set(d, 'source', e.target.value)}><option value="">선택</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
              <div>지원일</div><input value={val(d, 'applied_at')} onChange={(e) => set(d, 'applied_at', e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button className="danger" onClick={async () => { await api(`/intake/${d.id}/reject`, { body: {} }); load(); }}>반려</button>
            <button className="primary" onClick={() => approve(d)}>확인했고 등록</button>
          </div>
        </div>
      ))}
    </Shell>
  );
}
