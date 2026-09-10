import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Fonts } from '@/constants/Fonts';

export type DashboardTile = {
  key?: string;
  label: string;
  value: string | number;
  hint?: string;
  tint?: 'risk' | 'warn' | 'ok';
  selected?: boolean;
  onPress?: () => void;
};

const TINT: Record<NonNullable<DashboardTile['tint']>, { bg: string; border: string }> = {
  risk: { bg: 'rgba(215,68,62,.36)', border: 'rgba(255,176,168,.5)' },
  warn: { bg: 'rgba(233,127,46,.36)', border: 'rgba(255,196,140,.5)' },
  ok: { bg: 'rgba(46,158,150,.28)', border: 'rgba(160,220,210,.4)' },
};

export function DashboardPanel({
  tiles,
  footer,
  header,
}: {
  tiles: DashboardTile[];
  footer?: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      {header}
      <View style={styles.row}>
        {tiles.map((t) => {
          const tint = t.tint ? TINT[t.tint] : null;
          const tileStyle: ViewStyle = {
            backgroundColor: tint?.bg || 'rgba(255,255,255,.10)',
            borderWidth: 2,
            borderColor: t.selected ? '#FFFFFF' : (tint?.border || 'rgba(255,255,255,.18)'),
          };
          const inner = (
            <>
              <Text style={styles.label}>{t.label}</Text>
              <Text style={styles.value} numberOfLines={2}>{t.value}</Text>
              {t.hint ? <Text style={styles.hint} numberOfLines={2}>{t.hint}</Text> : null}
            </>
          );
          const key = t.key || t.label;
          if (t.onPress) {
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tile, tileStyle]}
                onPress={t.onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: !!t.selected }}
              >
                {inner}
              </TouchableOpacity>
            );
          }
          return (
            <View key={key} style={[styles.tile, tileStyle]}>
              {inner}
            </View>
          );
        })}
      </View>
      {footer ? <View>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#26265E',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 68,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  label: { fontFamily: Fonts.bold, fontSize: 11, fontWeight: '700', color: '#B9BCE0' },
  value: { fontFamily: Fonts.extrabold, fontSize: 22, fontWeight: '800', color: '#fff' },
  hint: { fontFamily: Fonts.regular, fontSize: 11, color: '#B9BCE0' },
});
