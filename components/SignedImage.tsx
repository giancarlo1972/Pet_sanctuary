import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ImageStyle } from 'react-native';
import { PawPrint } from 'lucide-react-native';
import { useSignedUrl } from '@/hooks/useSignedUrls';
import { isUsablePhoto } from '@/lib/photos';
import { Colors } from '@/constants/Colors';

interface SignedImageProps {
  path: string | null | undefined;
  style: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fallbackIconSize?: number;
}

export default function SignedImage({ path, style, resizeMode = 'cover', fallbackIconSize = 28 }: SignedImageProps) {
  const usable = isUsablePhoto(path);
  const { url, loading } = useSignedUrl(usable ? path : null);

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

  return <Image source={{ uri: url! }} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
});
