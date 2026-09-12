import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ImageStyle, Platform } from 'react-native';
import { PawPrint } from 'lucide-react-native';
import { useSignedUrl } from '@/hooks/useSignedUrls';
import { isUsablePhoto } from '@/lib/photos';
import { Colors } from '@/constants/Colors';
import { clampFocal, type Focal } from '@/lib/coalesce';

interface SignedImageProps {
  path: string | null | undefined;
  style: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fallbackIconSize?: number;
  focal?: Focal | null;
}

export default function SignedImage({ path, style, resizeMode = 'cover', fallbackIconSize = 28, focal }: SignedImageProps) {
  const usable = isUsablePhoto(path);
  const { url, loading } = useSignedUrl(usable ? path : null);
  const f = clampFocal(focal);

  if (!usable || (!loading && !url)) {
    return (
      <View style={[style as any, styles.placeholder]}>
        <PawPrint color={Colors.textTertiary} size={fallbackIconSize} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[style as any, styles.placeholder]}>
        <ActivityIndicator color={Colors.textTertiary} size="small" />
      </View>
    );
  }

  const focalStyle = f && (resizeMode === 'cover' || !resizeMode) && Platform.OS === 'web'
    ? ({ objectPosition: `${Math.round(f.x * 100)}% ${Math.round(f.y * 100)}%` } as any)
    : null;

  return (
    <View style={[style as any, { overflow: 'hidden' }]}>
      <Image
        source={{ uri: url! }}
        style={[StyleSheet.absoluteFill, focalStyle]}
        resizeMode={resizeMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
});
