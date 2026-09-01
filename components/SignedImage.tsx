import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, ImageStyle } from 'react-native';
import { PawPrint, ImageOff } from 'lucide-react-native';
import { useSignedUrl } from '@/hooks/useSignedUrls';
import { Colors } from '@/constants/Colors';

interface SignedImageProps {
  path: string | null | undefined;
  style: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fallbackIconSize?: number;
}

export default function SignedImage({ path, style, resizeMode = 'cover', fallbackIconSize = 28 }: SignedImageProps) {
  const { url, loading, error } = useSignedUrl(path);

  if (loading) {
    return (
      <View style={[style, styles.placeholder]}>
        <ActivityIndicator color={Colors.textTertiary} size="small" />
      </View>
    );
  }

  if (error || !url) {
    return (
      <View style={[style, styles.placeholder]}>
        <ImageOff color={Colors.error || '#EF4444'} size={fallbackIconSize} />
        <Text style={styles.errorText}>Failed to load</Text>
      </View>
    );
  }

  return <Image source={{ uri: url }} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  errorText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
