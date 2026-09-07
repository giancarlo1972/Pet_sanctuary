import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

export type ClinicalSource = 'vet' | 'ai_extracted' | 'owner' | 'device' | string | null | undefined;

export function normalizeSource(source?: ClinicalSource): 'vet' | 'ai_extracted' | 'owner' | 'device' {
  const s = String(source || '').toLowerCase().trim();
  if (s === 'vet' || s === 'veterinarian') return 'vet';
  if (s === 'ai_extracted' || s === 'ai') return 'ai_extracted';
  if (s === 'device' || s === 'scale' || s === 'sensor') return 'device';
  return 'owner';
}

export function SourceBadge({ source }: { source?: ClinicalSource }) {
  const s = normalizeSource(source);
  const spec = s === 'vet'
    ? { label: 'Vet', bg: Colors.navy, fg: Colors.white }
    : s === 'ai_extracted'
      ? { label: 'AI', bg: Colors.tealBg, fg: Colors.tealDark }
      : s === 'device'
        ? { label: 'Device', bg: Colors.standardBg, fg: Colors.accentDark }
        : { label: 'Owner', bg: Colors.surface, fg: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: spec.bg }]}>
      <Text style={[styles.txt, { color: spec.fg }]}>{spec.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  txt: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.3 },
});
