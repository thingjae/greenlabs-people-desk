import { q, one } from './db';
import { embed } from './ai';
// pdf-parse의 index.js는 테스트 파일을 읽으려 하므로 lib 경로를 직접 사용
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export async function pdfPages(buf: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdfParse(buf, {
    pagerender: async (pageData: any) => {
      const tc = await pageData.getTextContent({ normalizeWhitespace: true });
      let lastY: number | null = null;
      let text = '';
      for (const item of tc.items) {
        const y = item.transform[5];
        if (lastY !== null && Math.abs(lastY - y) > 2) text += '\n';
        text += item.str;
        lastY = y;
      }
      pages.push(text);
      return text;
    },
  });
  return pages;
}

const NOISE = [/^그린랩스 .*(규정집|가이드|지침)\s*개정일.*$/, /^-\s*\d+\s*\/\s*\d+\s*-$/, /^그린랩스\s/, /^개정일 \d{4}-\d{2}-\d{2}$/];

interface Chunk { page: number; article: string; text: string }

/** 조항(제N조) 또는 장·소제목 단위로 자른다. 표지와 목차(1~2쪽)는 건너뛴다. */
export function chunkPages(pages: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let chapter = '';
  let cur: Chunk | null = null;
  const flush = () => { if (cur && cur.text.trim().length > 15) chunks.push({ ...cur, text: cur.text.replace(/\s+/g, ' ').trim() }); cur = null; };
  pages.forEach((raw, idx) => {
    const page = idx + 1;
    if (page <= 2) return;
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !NOISE.some((r) => r.test(l)));
    for (const line of lines) {
      const chap = line.match(/^(제\d+장 .+|별표 \d+\..+|부칙 및 개정 이력|개정 이력)$/);
      const art = line.match(/^(제\d+조\([^)]+\))(.*)$/);
      const sub = line.match(/^(\d+)\.\s(.{2,30})$/);
      if (chap) { flush(); chapter = chap[1]; cur = { page, article: chapter, text: '' }; continue; }
      if (art) { flush(); cur = { page, article: art[1], text: art[2] ? art[2] + ' ' : '' }; continue; }
      if (sub && cur && !/^제\d+조/.test(cur.article)) { flush(); cur = { page, article: `${chapter} > ${sub[1]}. ${sub[2]}`, text: '' }; continue; }
      if (!cur) cur = { page, article: chapter || `${page}쪽`, text: '' };
      cur.text += line + ' ';
      if (cur.text.length > 1400) { const a = cur.article; flush(); cur = { page, article: a + ' (계속)', text: '' }; }
    }
  });
  flush();
  return chunks;
}

export async function ingestDocument(opts: { buf: Buffer; docType: string; title: string; revisedAt: string; fileName: string; uploadedBy?: number }) {
  const pages = await pdfPages(opts.buf);
  const chunks = chunkPages(pages);
  const prev = await one(`SELECT COALESCE(MAX(version),0) v FROM documents WHERE doc_type=$1`, [opts.docType]);
  await q(`UPDATE documents SET is_active=false WHERE doc_type=$1`, [opts.docType]);
  const doc = await one(
    `INSERT INTO documents(doc_type,title,revised_at,file_name,version,is_active,uploaded_by) VALUES($1,$2,$3,$4,$5,true,$6) RETURNING *`,
    [opts.docType, opts.title, opts.revisedAt, opts.fileName, Number(prev.v) + 1, opts.uploadedBy ?? null],
  );
  const vectors = await embed(chunks.map((c) => `${opts.title} ${c.article}\n${c.text}`));
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    await q(`INSERT INTO doc_chunks(document_id,page,article,text,embedding) VALUES($1,$2,$3,$4,$5)`, [doc.id, c.page, c.article, c.text, vectors ? vectors[i] : null]);
  }
  return { ...doc, chunks: chunks.length, pages: pages.length, embedded: !!vectors };
}
