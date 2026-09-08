const SPARSE_CHARS_PER_PAGE = 200;
const MAX_PAGES = 10;
const MAX_EDGE = 1600;

export type PdfExtract = {
  text: string;
  pageCount: number;
  charCount: number;
  mode: 'text' | 'images';
  images: string[];
};

export async function extractPdfText(uri: string): Promise<{ text: string; pageCount: number; charCount: number }> {
  const r = await extractPdf(uri);
  return { text: r.text, pageCount: r.pageCount, charCount: r.charCount };
}

export async function extractPdf(uri: string, opts?: { forceImages?: boolean }): Promise<PdfExtract> {
  const empty: PdfExtract = { text: '', pageCount: 0, charCount: 0, mode: 'text', images: [] };
  if (typeof document === 'undefined') return empty;
  const pdfjs: any = await loadPdfJs();
  const data = await (await fetch(uri)).arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages || 0;
  const parts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = (content.items || []).map((it: any) => it.str || '').join(' ');
    parts.push(line);
  }
  const text = parts.join('\n');
  const charCount = text.length;
  const sparse = pageCount > 0 && charCount / pageCount < SPARSE_CHARS_PER_PAGE;
  if (!opts?.forceImages && !sparse) {
    return { text, pageCount, charCount, mode: 'text', images: [] };
  }
  const images: string[] = [];
  const limit = Math.min(pageCount, MAX_PAGES);
  for (let i = 1; i <= limit; i++) {
    try {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.7, MAX_EDGE / Math.max(base.width, base.height, 1));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      let quality = 0.72;
      let url = canvas.toDataURL('image/jpeg', quality);
      while (url.length > 1_200_000 && quality > 0.45) {
        quality -= 0.1;
        url = canvas.toDataURL('image/jpeg', quality);
      }
      images.push(url);
    } catch (e) {
      console.warn('[pdf] render page failed', i, e);
    }
  }
  return {
    text,
    pageCount,
    charCount,
    mode: images.length ? 'images' : 'text',
    images,
  };
}

async function loadPdfJs(): Promise<any> {
  const w = globalThis as any;
  if (w.pdfjsLib) return w.pdfjsLib;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('pdf.js failed to load'));
    document.head.appendChild(s);
  });
  w.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return w.pdfjsLib;
}
