import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { blobToDataUrl, compressImage } from '@/lib/prepare-image';

export const PICKER_OPTS = {
  mediaTypes: 'images' as const,
  quality: 0.6,
  allowsEditing: false as const,
  exif: false as const,
};

export class PickImageError extends Error {
  code: 'camera-denied' | 'library-denied' | 'read';
  constructor(code: 'camera-denied' | 'library-denied' | 'read', message: string) {
    super(message);
    this.code = code;
  }
}

export type PickedImage = {
  blob: Blob;
  uri: string;
  dataUrl: string;
};

/** Compress a user-picked File/Blob to 1600px JPEG @ 0.6. */
export async function imageFromFile(file: Blob): Promise<PickedImage> {
  if (!file) throw new PickImageError('read', 'Could not read that picture.');
  const blob = await compressImage(file);
  const uri = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
  try {
    const dataUrl = await blobToDataUrl(blob);
    return { blob, uri, dataUrl };
  } catch (e: any) {
    if (uri) URL.revokeObjectURL(uri);
    throw new PickImageError('read', e?.message || 'Could not read that picture.');
  }
}

function pickWebFile(capture: boolean): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 600);
    };
    input.onchange = () => finish(input.files?.[0] || null);
    document.body.appendChild(input);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

export async function pickImage(opts?: { camera?: boolean }): Promise<PickedImage | null> {
  try {
    if (Platform.OS === 'web') {
      const file = await pickWebFile(!!opts?.camera);
      if (!file) return null;
      return imageFromFile(file);
    }

    if (opts?.camera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') throw new PickImageError('camera-denied', 'Camera access is off.');
      const result = await ImagePicker.launchCameraAsync(PICKER_OPTS);
      if (result.canceled || !result.assets?.[0]) return null;
      return nativeAsset(result.assets[0]);
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new PickImageError('library-denied', 'Photo library access is needed.');
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
    if (result.canceled || !result.assets?.[0]) return null;
    return nativeAsset(result.assets[0]);
  } catch (e: any) {
    if (e instanceof PickImageError) throw e;
    throw new PickImageError('read', e?.message || 'Could not read that picture.');
  }
}

async function nativeAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const blob = await (await fetch(asset.uri)).blob();
  return imageFromFile(blob);
}

export function releasePicked(uri: string | null | undefined) {
  if (uri && uri.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(uri);
}
