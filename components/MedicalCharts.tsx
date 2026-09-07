import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

export type ChartPt = { v: number; at?: string | null; out?: boolean };

function catmull(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function AreaChart({
  points,
  height = 160,
  target,
  unit = '',
  color = Colors.teal,
}: {
  points: ChartPt[];
  height?: number;
  target?: number | null;
  unit?: string;
  color?: string;
}) {
  const [tip, setTip] = useState<string | null>(null);
  const gid = `fill${color.replace('#', '')}${height}`;
  const usable = points.filter((p) => Number.isFinite(p.v));
  if (!usable.length) return <Text style={styles.empty}>No measurements yet</Text>;
  const w = 640;
  const pad = 12;
  const vals = usable.map((p) => p.v);
  if (target != null) vals.push(target);
  const min = Math.min(...vals) - Math.abs(Math.max(...vals) - Math.min(...vals)) * 0.08 - 0.2;
  const max = Math.max(...vals) + Math.abs(Math.max(...vals) - Math.min(...vals)) * 0.08 + 0.2;
  const span = Math.max(0.5, max - min);
  const xy = usable.map((p, i) => ({
    x: pad + (i * (w - pad * 2)) / Math.max(1, usable.length - 1),
    y: pad + (1 - (p.v - min) / span) * (height - pad * 2),
    p,
  }));
  const line = catmull(xy);
  const area = `${line} L ${xy[xy.length - 1].x} ${height - 4} L ${xy[0].x} ${height - 4} Z`;
  const ty = target != null ? pad + (1 - (target - min) / span) * (height - pad * 2) : null;
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.22" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${gid})`} />
        {ty != null ? <Line x1={pad} y1={ty} x2={w - pad} y2={ty} stroke={Colors.coral} strokeWidth={1.5} strokeDasharray="7 5" /> : null}
        <Path d={line} fill="none" stroke={color} strokeWidth={2.4} />
        {xy.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={4} fill={pt.p.out ? Colors.coral : color} />
        ))}
      </Svg>
      <View style={styles.hitRow}>
        {xy.map((pt, i) => (
          <Pressable
            key={i}
            style={{ flex: 1, height: 22 }}
            onPress={() => setTip(`${pt.p.v}${unit ? ` ${unit}` : ''} · ${pt.p.at || '—'}`)}
          />
        ))}
      </View>
      {tip ? <Text style={styles.tip}>{tip}</Text> : <Text style={styles.hint}>Tap a point for value + date</Text>}
    </View>
  );
}

export function HealthRing({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - s / 100);
  const col = s >= 80 ? Colors.teal : s >= 60 ? Colors.accent : Colors.coral;
  return (
    <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={88} height={88} viewBox="0 0 88 88">
        <Circle cx={44} cy={44} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={8} fill="none" />
        <Circle
          cx={44} cy={44} r={r}
          stroke={col} strokeWidth={8} fill="none"
          strokeDasharray={`${c}`} strokeDashoffset={dash}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject as any} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.white }}>{s}</Text>
        </View>
      </View>
    </View>
  );
}

export function RefBand({
  value, low, high, flag,
}: {
  value: number | null;
  low?: number | null;
  high?: number | null;
  flag?: string | null;
}) {
  const lo = low ?? (value != null ? value * 0.7 : 0);
  const hi = high ?? (value != null ? value * 1.3 : 1);
  const min = Math.min(lo, value ?? lo) - (hi - lo) * 0.25;
  const max = Math.max(hi, value ?? hi) + (hi - lo) * 0.25;
  const span = Math.max(0.001, max - min);
  const pct = (n: number): `${number}%` => `${((n - min) / span) * 100}%`;
  const f = String(flag || '').toLowerCase();
  const marker = f === 'high' || f === 'abnormal' ? Colors.coral : f === 'low' ? Colors.accent : Colors.navy;
  return (
    <View style={styles.band}>
      <View style={[styles.bandZone, { left: 0, width: pct(lo), backgroundColor: Colors.standardBg } as any]} />
      <View style={[styles.bandZone, { left: pct(lo), width: `${((hi - lo) / span) * 100}%`, backgroundColor: Colors.tealBg } as any]} />
      <View style={[styles.bandZone, { left: pct(hi), right: 0, backgroundColor: Colors.coralBg } as any]} />
      {value != null ? <View style={[styles.bandMark, { left: pct(value), backgroundColor: marker } as any]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textTertiary, paddingVertical: 12 },
  tip: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.navy, marginTop: 4 },
  hint: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  hitRow: { flexDirection: 'row', marginTop: -18 },
  band: { height: 10, borderRadius: 6, backgroundColor: Colors.surface, overflow: 'hidden', position: 'relative', marginTop: 6 },
  bandZone: { position: 'absolute', top: 0, bottom: 0 },
  bandMark: { position: 'absolute', top: -2, width: 4, height: 14, borderRadius: 2, marginLeft: -2 },
});
