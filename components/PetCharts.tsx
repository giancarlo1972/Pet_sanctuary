import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polyline, Line, Circle, G } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

export type WeightPoint = { weight_lb: number; measured_on: string | null; source?: string | null };

export function WeightLineChart({
  points,
  targetLb,
  height = 88,
  compact = false,
}: {
  points: WeightPoint[];
  targetLb?: number | null;
  height?: number;
  compact?: boolean;
}) {
  const [tip, setTip] = useState<string | null>(null);
  const w = compact ? 280 : 640;
  const pad = 8;
  const usable = points.filter((p) => typeof p.weight_lb === 'number');
  if (usable.length < 1) return null;
  const vals = usable.map((p) => p.weight_lb);
  if (targetLb != null) vals.push(targetLb);
  const min = Math.min(...vals) - 0.4;
  const max = Math.max(...vals) + 0.4;
  const span = Math.max(0.5, max - min);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, usable.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const poly = usable.map((p, i) => `${x(i)},${y(p.weight_lb)}`).join(' ');
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        {targetLb != null ? (
          <Line x1={pad} y1={y(targetLb)} x2={w - pad} y2={y(targetLb)} stroke={Colors.coral} strokeWidth={1.5} strokeDasharray="6 4" />
        ) : null}
        <Polyline points={poly} fill="none" stroke={Colors.teal} strokeWidth={2} />
        {usable.map((p, i) => (
          <G key={i} onPress={() => setTip(`${p.weight_lb} lb · ${p.measured_on || '—'} · ${p.source || 'recorded'}`)}>
            <Circle cx={x(i)} cy={y(p.weight_lb)} r={4} fill={Colors.navy} />
          </G>
        ))}
      </Svg>
      <View style={styles.row}>
        {usable.map((p, i) => (
          <Pressable key={i} onPress={() => setTip(`${p.weight_lb} lb · ${p.measured_on || '—'} · ${p.source || 'recorded'}`)} style={{ flex: 1, height: 16 }} />
        ))}
      </View>
      {tip ? <Text style={styles.tip}>{tip}</Text> : <Text style={styles.hint}>Tap a point for date / source</Text>}
    </View>
  );
}

export function LabSparkline({ values, color = Colors.navy }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 120, h = 36, pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.75} />
      <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: -16 },
  tip: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.navy, marginTop: 4 },
  hint: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
});
