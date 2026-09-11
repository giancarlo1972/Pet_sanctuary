import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  type ViewStyle,
} from 'react-native';
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

const INTER8 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;
const INTER6 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.semibold;

export function compactTileValue(raw: string | number): string {
  let s = String(raw ?? '');
  s = s.replace(/(\d+(?:\.\d+)?)\s+lb\b/gi, '$1\u00a0lb');
  const thru = s.match(/^(?:Valid\s+)?thru\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (thru) return `thru ${thru[1]} ${thru[3]}`;
  return s.replace(/\s*\n+\s*/g, ' ');
}

function isEmptyValue(v: string | number) {
  const s = String(v ?? '').trim();
  return !s || s === '—' || s === '-' || s === 'None' || /^not on file$/i.test(s) || /^no record$/i.test(s);
}

function FitValue({ value, empty }: { value: string; empty: boolean }) {
  const [fs, setFs] = useState(18);
  const boxW = useRef(0);
  useEffect(() => { setFs(18); }, [value]);
  return (
    <View
      style={styles.valueBox}
      onLayout={(e) => { boxW.current = e.nativeEvent.layout.width; }}
    >
      <Text
        style={[styles.value, empty && styles.valueMuted, { fontSize: fs }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        onTextLayout={(e) => {
          const line = e.nativeEvent.lines?.[0];
          if (!line || !boxW.current) return;
          if (line.width > boxW.current + 1 && fs > 14) {
            setFs((s) => (s > 16 ? 16 : 14));
          }
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function DashboardPanel({
  tiles,
  footer,
  header,
}: {
  tiles: DashboardTile[];
  footer?: React.ReactNode;
  header?: React.ReactNode;
}) {
  const { width: winW } = useWindowDimensions();
  const phone = winW < 400;
  const pad = phone ? 12 : 16;
  const gap = 8;
  const cols = phone ? 2 : Math.min(4, Math.max(tiles.length, 1));
  const [innerW, setInnerW] = useState(0);
  const tileW = innerW > 0 ? Math.floor((innerW - gap * (cols - 1)) / cols) : undefined;

  return (
    <View
      style={[styles.panel, { padding: pad }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width - pad * 2;
        if (w > 0 && Math.abs(w - innerW) > 1) setInnerW(w);
      }}
    >
      {header}
      <View style={styles.row}>
        {tiles.map((t) => {
          const tint = t.tint ? TINT[t.tint] : null;
          const tileStyle: ViewStyle = {
            backgroundColor: tint?.bg || 'rgba(255,255,255,.10)',
            borderWidth: 2,
            borderColor: t.selected ? '#FFFFFF' : (tint?.border || 'rgba(255,255,255,.18)'),
            width: tileW,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: tileW || (phone ? '47%' : undefined),
          };
          const display = compactTileValue(t.value);
          const empty = isEmptyValue(display);
          const inner = (
            <>
              <Text style={styles.label}>{t.label}</Text>
              <FitValue value={display} empty={empty} />
              {t.hint ? <Text style={styles.hint} numberOfLines={1}>{t.hint}</Text> : null}
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
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  tile: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
    minHeight: 64,
  },
  label: { fontFamily: INTER6, fontSize: 10.5, fontWeight: '600', color: '#B9BCE0' },
  valueBox: { width: '100%', minHeight: 22, justifyContent: 'center' },
  value: { fontFamily: INTER8, fontSize: 18, fontWeight: '800', color: '#fff' },
  valueMuted: { color: '#B9BCE0' },
  hint: { fontFamily: INTER6, fontSize: 10.5, fontWeight: '600', color: '#B9BCE0' },
  footer: { width: '100%' },
});
