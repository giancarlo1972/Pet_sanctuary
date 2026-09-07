import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

export const CONTENT_MAX = 720;

export function Page({
  children,
  scroll = true,
  wideMax = CONTENT_MAX,
  refreshControl,
}: {
  children: React.ReactNode;
  /** false only when the screen owns a root FlatList/ScrollView */
  scroll?: boolean;
  wideMax?: number;
  refreshControl?: React.ReactElement;
}) {
  const inner = (
    <View style={[s.col, { maxWidth: wideMax }, !scroll && s.colFill]}>{children}</View>
  );
  return scroll ? (
    <ScrollView
      style={s.fill}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {inner}
    </ScrollView>
  ) : (
    <View style={s.frame}>{inner}</View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 48 },
  frame: { flex: 1, width: '100%', alignItems: 'center' },
  col: { width: '100%', paddingHorizontal: 16, gap: 14 },
  colFill: { flex: 1 },
});
