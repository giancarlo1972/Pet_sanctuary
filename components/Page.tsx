import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

export const CONTENT_MAX = 720;

export function Page({
  children,
  scroll = true,
  wideMax = CONTENT_MAX,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  wideMax?: number;
}) {
  const inner = <View style={[s.col, { maxWidth: wideMax }]}>{children}</View>;
  return scroll ? (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {inner}
    </ScrollView>
  ) : (
    <View style={s.frame}>{inner}</View>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 48 },
  frame: { flex: 1, alignItems: 'center' },
  col: { width: '100%', paddingHorizontal: 16, gap: 14 },
});
