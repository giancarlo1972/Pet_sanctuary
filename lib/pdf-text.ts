export async function extractPdfText(uri: string): Promise<{ text: string; pageCount: number; charCount: number }> {
  if (typeof document === 'undefined') return { text: '', pageCount: 0, charCount: 0 };
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
  return { text, pageCount, charCount: text.length };
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
