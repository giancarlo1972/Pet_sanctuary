import { clampFocal, type Focal } from '@/lib/coalesce';

export type CropRect = { x: number; y: number; w: number; h: number };

export function coverScale(imgW: number, imgH: number, frameW: number, frameH: number): number {
  if (!imgW || !imgH || !frameW || !frameH) return 1;
  return Math.max(frameW / imgW, frameH / imgH);
}

/** Image is centered in the frame, then translated by tx/ty (frame pixels) and scaled. */
export function frameToCrop(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  scale: number,
  tx: number,
  ty: number,
): { crop: CropRect; focal: Focal } {
  const left = (frameW - imgW * scale) / 2 + tx;
  const top = (frameH - imgH * scale) / 2 + ty;
  let x = (0 - left) / scale;
  let y = (0 - top) / scale;
  let w = frameW / scale;
  let h = frameH / scale;
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > imgW) w = imgW - x;
  if (y + h > imgH) h = imgH - y;
  w = Math.max(1, w);
  h = Math.max(1, h);
  const focal = clampFocal({
    x: (x + w / 2) / imgW,
    y: (y + h / 2) / imgH,
  }) || { x: 0.5, y: 0.5 };
  return { crop: { x, y, w, h }, focal };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that picture.'));
    img.src = src;
  });
}

async function canvasCrop(src: string, crop: CropRect): Promise<Blob> {
  const img = await loadHtmlImage(src);
  const sx = Math.max(0, Math.round(crop.x));
  const sy = Math.max(0, Math.round(crop.y));
  const sw = Math.max(1, Math.round(Math.min(crop.w, img.width - sx)));
  const sh = Math.max(1, Math.round(Math.min(crop.h, img.height - sy)));
  const longest = Math.max(sw, sh);
  const scale = longest > 1600 ? 1600 / longest : 1;
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop image.');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not crop image.'))), 'image/jpeg', 0.8);
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

export async function cropImage(src: string, crop: CropRect): Promise<Blob> {
  try {
    // Optional native crop (Expo). Falls back to canvas on web / Pages.
    const ImageManipulator: any = await (Function('return import("expo-image-manipulator")')());
    const result = await ImageManipulator.manipulateAsync(
      src,
      [{
        crop: {
          originX: Math.max(0, Math.round(crop.x)),
          originY: Math.max(0, Math.round(crop.y)),
          width: Math.max(1, Math.round(crop.w)),
          height: Math.max(1, Math.round(crop.h)),
        },
      }, { resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const blob = await (await fetch(result.uri)).blob();
    if (blob && blob.size > 0) return blob;
  } catch {
    // canvas fallback
  }
  return canvasCrop(src, crop);
}
