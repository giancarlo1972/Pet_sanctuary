import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { LabSparkline } from '@/components/PetCharts';
import { classifyLab } from '@/components/MedicalDashboard';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LabsByAnalyte({ rows }: { rows: any[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Hematology: true, Chemistry: true, Endocrinology: true, Urinalysis: true,
  });
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of rows || []) {
      const name = (row.analyte || row.name || '').trim();
      if (!name) continue;
      const arr = map.get(name.toLowerCase()) || [];
      arr.push(row);
      map.set(name.toLowerCase(), arr);
    }
    const items = [...map.entries()].map(([key, list]) => {
      const sorted = [...list].sort((a, b) => String(a.collected_on || a.created_at || '').localeCompare(String(b.collected_on || b.created_at || '')));
      const cur = sorted[sorted.length - 1];
      const nums = sorted.map((r) => parseFloat(r.value ?? r.value_num ?? r.value_text)).filter((n) => !Number.isNaN(n));
      const flag = String(cur.flag || '').toLowerCase();
      return {
        key,
        label: cur.analyte || cur.name,
        group: classifyLab(cur.analyte || cur.name),
        value: cur.value ?? cur.value_text ?? cur.value_num,
        unit: cur.unit || '',
        flag,
        nums,
        last: cur.collected_on || cur.created_at,
      };
    });
    return {
      Hematology: items.filter((i) => i.group === 'Hematology'),
      Chemistry: items.filter((i) => i.group === 'Chemistry'),
      Endocrinology: items.filter((i) => i.group === 'Endocrinology'),
      Urinalysis: items.filter((i) => i.group === 'Urinalysis'),
    };
  }, [rows]);

  const groups = ['Hematology', 'Chemistry', 'Endocrinology', 'Urinalysis'] as const;
  if (!rows?.length) return <Text style={styles.empty}>No lab results on file.</Text>;

  return (
    <View style={{ gap: 10 }}>
      {groups.map((g) => {
        if (!grouped[g].length) return null;
        const shown = open[g] !== false;
        return (
          <View key={g} style={styles.card}>
            <TouchableOpacity onPress={() => setOpen((s) => ({ ...s, [g]: !shown }))} style={styles.head} activeOpacity={0.85}>
              <Text style={styles.kicker}>{g.toUpperCase()}</Text>
              <Text style={styles.link}>{shown ? 'Hide' : 'Show'} · {grouped[g].length}</Text>
            </TouchableOpacity>
            {shown ? grouped[g].map((it) => (
              <View key={it.key} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{it.label}</Text>
                  <Text style={styles.meta}>
                    {it.value ?? '—'}{it.unit ? ` ${it.unit}` : ''} · {formatDate(it.last)}
                  </Text>
                </View>
                <View style={[styles.pill, (it.flag === 'high' || it.flag === 'abnormal') ? { backgroundColor: Colors.criticalBg } : it.flag === 'low' ? { backgroundColor: Colors.standardBg } : { backgroundColor: Colors.tealBg }]}>
                  <Text style={styles.pillTxt}>{it.flag || 'normal'}</Text>
                </View>
                {it.nums.length > 1 ? <LabSparkline values={it.nums} color={it.flag === 'high' || it.flag === 'abnormal' ? Colors.critical : Colors.navy} /> : null}
              </View>
            )) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.7, color: Colors.textTertiary },
  link: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4 },
  name: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.navy },
  empty: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, paddingVertical: 8 },
});
