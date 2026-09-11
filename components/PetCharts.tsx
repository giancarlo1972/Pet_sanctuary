import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polyline, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

export type WeightPoint = { weight_lb: number | string | null; measured_on: string | null; source?: string | null; bcs?: number | null };

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

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
  const pad = 18;
  const usable: { weight_lb: number; measured_on: string | null; source?: string | null; bcs: number | null }[] = [];
  for (const p of points) {
    const lb = toNum(p.weight_lb);
    if (lb == null) continue;
    usable.push({
      weight_lb: lb,
      measured_on: p.measured_on,
      source: p.source,
      bcs: toNum(p.bcs),
    });
  }
  usable.sort((a, b) => String(a.measured_on || '').localeCompare(String(b.measured_on || '')));
  if (typeof console !== 'undefined') console.log('weights.length', usable.length);
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
          <G key={i} onPress={() => setTip(`${p.weight_lb} lb${p.bcs != null ? ` · BCS ${p.bcs}` : ''} · ${p.measured_on || '—'} · ${p.source || 'recorded'}`)}>
            <Circle cx={x(i)} cy={y(p.weight_lb)} r={4} fill={Colors.navy} />
            {p.bcs != null ? (
              <SvgText x={x(i)} y={y(p.weight_lb) - 8} fontSize="9" fontWeight="700" fill={Colors.navy} textAnchor="middle">
                {p.bcs}
              </SvgText>
            ) : null}
          </G>
        ))}
      </Svg>
      <View style={styles.row}>
        {usable.map((p, i) => (
          <Pressable
            key={i}
            onPress={() => setTip(`${p.weight_lb} lb${p.bcs != null ? ` · BCS ${p.bcs}` : ''} · ${p.measured_on || '—'} · ${p.source || 'recorded'}`)}
            style={{ flex: 1, height: 16 }}
          />
        ))}
      </View>
      {tip ? <Text style={styles.tip}>{tip}</Text> : <Text style={styles.hint}>Tap a point for date / BCS / source</Text>}
    </View>
  );
}

export function LabSparkline({
  values,
  color = Colors.navy,
  tones,
  height = 40,
}: {
  values: number[];
  color?: string;
  tones?: ('ok' | 'due' | 'over' | 'unknown')[];
  height?: number;
}) {
  if (values.length < 1) return null;
  const w = 140, pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const toneColor = (t?: string) => t === 'over' ? Colors.critical : t === 'due' ? Colors.accent : t === 'ok' ? Colors.teal : color;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
      {values.length > 1 ? (
        <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.75} />
      ) : null}
      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={toneColor(tones?.[i])} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: -16 },
  tip: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.navy, marginTop: 4 },
  hint: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
});
