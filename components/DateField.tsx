import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const iso = (value || '').slice(0, 10);
  if (Platform.OS === 'web') {
    return (
      <View style={s.wrap}>
        {label ? <Text style={s.label}>{label}</Text> : null}
        {React.createElement('input', {
          type: 'date',
          value: iso,
          onChange: (e: any) => onChange(e.target.value || ''),
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${Colors.borderInput}`,
            width: '100%',
            color: Colors.text,
            background: Colors.white,
          },
        })}
      </View>
    );
  }
  const [y, m, d] = iso ? iso.split('-') : ['', '', ''];
  const set = (part: 'y' | 'm' | 'd', v: string) => {
    const next = { y: y || '2026', m: m || '01', d: d || '01', [part]: v };
    if (next.y.length === 4 && next.m && next.d) onChange(`${next.y}-${String(next.m).padStart(2, '0')}-${String(next.d).padStart(2, '0')}`);
  };
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.row}>
        {React.createElement('input', { type: 'date', value: iso, onChange: (e: any) => onChange(e.target.value || '') })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4, flex: 1 },
  label: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
});
