'use client';
export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export type Me = { id: number; name: string; role: 'PEOPLE' | 'INTERVIEWER' | 'EMPLOYEE'; employmentType?: string; title?: string };
export function getToken() { try { return localStorage.getItem('gl_token'); } catch { return null; } }
export function getMe(): Me | null { try { const s = localStorage.getItem('gl_me'); return s ? JSON.parse(s) : null; } catch { return null; } }
export function setSession(token: string, me: Me) { try { localStorage.setItem('gl_token', token); localStorage.setItem('gl_me', JSON.stringify(me)); } catch {} }
export function clearSession() { try { localStorage.removeItem('gl_token'); localStorage.removeItem('gl_me'); } catch {} }
export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), headers, body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth')) { clearSession(); window.location.href = '/login'; }
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(j?.message) ? j.message.join(', ') : j?.message || '요청 실패');
  return j as T;
}
