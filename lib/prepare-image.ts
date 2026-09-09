/** Downscale images to 1600px JPEG without reading the original into a data URL. */

const MAX_PX = 1600;
const JPEG_Q = 0.6;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function compressImage(file: Blob, maxPx = MAX_PX, quality = JPEG_Q): Promise<Blob> {
  if (typeof document === 'undefined') return file;
  if (file.type && !file.type.startsWith('image/')) return file;

  const objectUrl = URL.createObjectURL(file);
  let bitmap: ImageBitmap | HTMLImageElement | null = null;
  try {
    bitmap = typeof createImageBitmap === 'function'
      ? await createImageBitmap(file)
      : await loadImage(objectUrl);
    const longest = Math.max(bitmap.width, bitmap.height) || 1;
    const scale = longest > maxPx ? maxPx / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not compress image.');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not compress image.'))),
        'image/jpeg',
        quality,
      );
    });
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
    if (bitmap && 'close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** @deprecated use blobToDataUrl on a compressed blob */
export async function fileToDataUrl(file: Blob): Promise<string> {
  return blobToDataUrl(file);
}

export async function prepareImageFile(file: File): Promise<{ blob: Blob; dataUrl: string; mediaType: string }> {
  if (!file.type.startsWith('image/')) {
    if (file.size > 32_000_000) throw new Error('PDF too large (max 32 MB).');
    return { blob: file, dataUrl: await blobToDataUrl(file), mediaType: file.type || 'application/pdf' };
  }
  const blob = await compressImage(file);
  return { blob, dataUrl: await blobToDataUrl(blob), mediaType: 'image/jpeg' };
}
