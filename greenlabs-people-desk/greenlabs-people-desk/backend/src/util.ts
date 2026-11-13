export const FLOW = ['서류', '과제', '1차 면접', '2차 면접', '처우 협의', '입사'];
export const END = ['불합격', '중도 이탈'];
export const DROP_REASONS = ['지원 취소', '처우 결렬', '입사 포기', '과제 미제출'];
export const SOURCES = ['사람인', '원티드', '잡코리아', '리멤버', '로켓펀치', '사내 추천', '회사 채용 페이지'];

export function flowFor(hasTask: boolean) {
  return FLOW.filter((s) => hasTask || s !== '과제');
}

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD). DEMO_TODAY 환경변수로 고정 가능 */
export function today(): Date {
  const fixed = process.env.DEMO_TODAY;
  if (fixed) return new Date(fixed + 'T00:00:00Z');
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
export function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00Z');
  const d = new Date(v);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function ymd(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}
/** 영업일 더하기 (주말 제외, 공휴일 미반영) */
export function addBizDays(d: Date, n: number) {
  const r = new Date(d);
  while (n > 0) {
    r.setUTCDate(r.getUTCDate() + 1);
    const w = r.getUTCDay();
    if (w !== 0 && w !== 6) n--;
  }
  return r;
}
/** from(제외) ~ to(포함) 사이 영업일 수. to가 from보다 앞이면 음수 */
export function bizDaysBetween(from: Date, to: Date) {
  if (to.getTime() === from.getTime()) return 0;
  const sign = to > from ? 1 : -1;
  let n = 0;
  const cur = new Date(from);
  while (sign > 0 ? cur < to : cur > to) {
    cur.setUTCDate(cur.getUTCDate() + sign);
    const w = cur.getUTCDay();
    if (w !== 0 && w !== 6) n += sign;
  }
  return n;
}
export function normalizePhone(p: any): string {
  if (!p) return '';
  const d = String(p).replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return String(p);
}
export const digits = (p: any) => String(p || '').replace(/\D/g, '');
