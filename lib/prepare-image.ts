/** Compress images over 1.5 MB (or longer than 1600px). Claude limit is 10 MB. */

const COMPRESS_BYTES = 1_500_000;

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function prepareImageFile(file: File): Promise<{ blob: Blob; dataUrl: string; mediaType: string }> {
  if (!file.type.startsWith('image/')) {
    if (file.size > 32_000_000) throw new Error('PDF too large (max 32 MB).');
    return { blob: file, dataUrl: await fileToDataUrl(file), mediaType: file.type || 'application/pdf' };
  }
  if (typeof document === 'undefined') {
    return { blob: file, dataUrl: await fileToDataUrl(file), mediaType: file.type || 'image/jpeg' };
  }
  const dataUrl = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const longest = Math.max(img.width, img.height) || 1;
  if (file.size <= COMPRESS_BYTES && longest <= 1600) {
    return { blob: file, dataUrl, mediaType: file.type || 'image/jpeg' };
  }
  const scale = longest > 1600 ? 1600 / longest : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not compress image.');
  ctx.drawImage(img, 0, 0, w, h);
  const outUrl = canvas.toDataURL('image/jpeg', 0.8);
  const raw = outUrl.split(',')[1] || '';
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  if (blob.size > 9_500_000) throw new Error('Image too large — please re-upload (max 10 MB).');
  return { blob, dataUrl: outUrl, mediaType: 'image/jpeg' };
}
