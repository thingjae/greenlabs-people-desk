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
    </Shell>
  );
}
