/** Device/picker URIs that must never be stored or rendered. */
export function isUsablePhoto(url?: string | null): boolean {
  if (!url || !url.trim()) return false;
  if (/^(file:|content:|blob:|data:|ph:|assets-library:)/i.test(url)) return false;
  if (url.includes('ImagePicker') || url.includes('/Containers/Data/') || url.includes('file://')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url)) return false;
  return true;
}
