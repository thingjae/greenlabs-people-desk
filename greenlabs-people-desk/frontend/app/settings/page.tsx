'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

const LABEL: Record<string, [string, string]> = {
  result_notice_bizdays: ['불합격 안내 기한 (영업일)', '고객 내부 원칙: 단계 종료 후 5영업일 안 안내'],
  eval_due_bizdays: ['면접 평가 제출 기한 (영업일)', '고객 미정 → 기본값 2영업일 (변경 가능)'],
  interview_minutes: ['면접 길이 (분)', '고객 미정 → 기본값 60분'],
  retention_days: ['불합격자 정보 보관 기간 (일)', '고객이 내부 결정 중 → 기본값 180일'],
};
export default function Settings() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  useEffect(() => { api('/settings').then((r) => setVals(Object.fromEntries(r.map((x: any) => [x.key, x.value])))); }, []);
  return (
    <Shell roles={['PEOPLE']}>
      <h1>설정</h1>
      <p className="desc">고객이 아직 정하지 않은 기준은 바꿀 수 있는 설정으로 두었습니다. 주말은 영업일에서 빼고, 공휴일은 반영하지 않습니다.</p>
      {msg && <div className={msg.t}>{msg.m}</div>}
      <div className="card">
        {Object.entries(LABEL).map(([k, [l, d]]) => (
          <div key={k} className="row" style={{ marginBottom: 10 }}>
            <div style={{ width: 240 }}><b>{l}</b><div className="small">{d}</div></div>
            <input value={vals[k] || ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} style={{ width: 100 }} />
          </div>
        ))}
        <button className="primary" onClick={async () => { try { await api('/settings', { method: 'PUT', body: vals }); setMsg({ t: 'ok', m: '저장했습니다' }); } catch (e: any) { setMsg({ t: 'err', m: e.message }); } }}>저장</button>
      </div>
      <div className="card">
        <h3>데모 데이터 초기화</h3>
        <p className="small">시연이 끝나면 눌러 주세요. 지원자 400명·평가표·문서 3종(규정집은 구버전 2026-03-01)·설정값이 처음 상태로 돌아가고, 시연 중 등록한 지원자·평가·질문 기록은 지워집니다. 30초쯤 걸리며, 끝나면 다시 로그인합니다.</p>
        <button className="danger" disabled={resetting} onClick={async () => {
          if (!confirm('데모 데이터를 처음 상태로 되돌릴까요? 시연 중 만든 기록이 모두 지워집니다.')) return;
          setResetting(true); setMsg(null);
          try { await api('/admin/reset-demo', { body: {} }); setMsg({ t: 'ok', m: '초기화했습니다. 로그인 화면으로 이동합니다.' }); setTimeout(() => { localStorage.removeItem('gl_token'); localStorage.removeItem('gl_me'); window.location.href = '/login'; }, 1500); }
          catch (e: any) { setMsg({ t: 'err', m: e.message }); }
          setResetting(false);
        }}>{resetting ? '초기화 중…' : '데모 데이터 초기화'}</button>
      </div>
    </Shell>
  );
}
