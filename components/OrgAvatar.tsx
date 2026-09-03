import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface OrgAvatarProps {
  name: string;
  size?: number;
  backgroundColor?: string;
}

const BRAND_COLORS = [Colors.coral, Colors.teal, Colors.navy, Colors.accent, Colors.coralDark, Colors.tealDark];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

export default function OrgAvatar({ name, size = 48, backgroundColor }: OrgAvatarProps) {
  const bg = backgroundColor || colorForName(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
});
