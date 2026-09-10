import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '@/constants/Fonts';

export type DashboardTile = {
  label: string;
  value: string | number;
  hint?: string;
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
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.label}>{t.label}</Text>
            <Text style={styles.value} numberOfLines={2}>{t.value}</Text>
            {t.hint ? <Text style={styles.hint} numberOfLines={2}>{t.hint}</Text> : null}
          </View>
        ))}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 88,
    backgroundColor: 'rgba(255,255,255,.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  label: { fontFamily: Fonts.bold, fontSize: 11, fontWeight: '700', color: '#B9BCE0' },
  value: { fontFamily: Fonts.extrabold, fontSize: 22, fontWeight: '800', color: '#fff' },
  hint: { fontFamily: Fonts.regular, fontSize: 11, color: '#B9BCE0' },
});
