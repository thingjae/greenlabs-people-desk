/** OpenAI 호출 (백엔드 전용). 키가 없거나 실패하면 null을 돌려주고, 호출한 쪽에서 대체 경로를 탄다. */
const KEY = () => process.env.OPENAI_API_KEY;
const BASE = () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

export const aiEnabled = () => !!KEY();

export async function chatJson(system: string, user: string): Promise<any | null> {
  if (!KEY()) return null;
  try {
    const res = await fetch(`${BASE()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) { console.error('openai chat', res.status, (await res.text()).slice(0, 300)); return null; }
    const j: any = await res.json();
    return JSON.parse(j.choices[0].message.content);
  } catch (e) {
    console.error('openai chat error', (e as Error).message);
    return null;
  }
}

export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!KEY() || texts.length === 0) return null;
  try {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 96) {
      const res = await fetch(`${BASE()}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
        body: JSON.stringify({ model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small', input: texts.slice(i, i + 96) }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) { console.error('openai embed', res.status); return null; }
      const j: any = await res.json();
      j.data.forEach((d: any) => out.push(d.embedding));
    }
    return out;
  } catch (e) {
    console.error('openai embed error', (e as Error).message);
    return null;
  }
}

export function cosine(a: number[], b: number[]) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** 한국어 키워드 점수: 2글자 묶음 겹침 비율 */
export function bigrams(s: string) {
  const t = s.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}
export function keywordScore(query: string, text: string) {
  const qb = bigrams(query);
  if (qb.size === 0) return 0;
  const tb = bigrams(text);
  let hit = 0;
  qb.forEach((b) => { if (tb.has(b)) hit++; });
  return hit / qb.size;
}
