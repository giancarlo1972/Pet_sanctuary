const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'application/octet-stream': 'bin',
};

export function extFromMimeType(mimeType: string | null | undefined): string {
  if (!mimeType) return 'jpg';
  const ext = MIME_TO_EXT[mimeType.toLowerCase()];
  if (ext) return ext;
  const sub = mimeType.split('/')[1];
  return sub ? sub.split(';')[0] : 'jpg';
}

export function extFromAsset(asset: { mimeType?: string | null; uri?: string; name?: string | null }): string {
  if (asset.mimeType) {
    const ext = extFromMimeType(asset.mimeType);
    if (ext !== 'bin') return ext;
  }
  if (asset.name && asset.name.includes('.')) {
    const parts = asset.name.split('.');
    return parts[parts.length - 1].toLowerCase();
  }
  return 'jpg';
}
