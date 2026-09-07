import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import type { CatalogRow } from '@/lib/catalog';

export type PickerItem = CatalogRow & { label?: string; sub?: string };

export function SearchablePicker({
  items,
  value,
  multi = false,
  values,
  onChange,
  onChangeMulti,
  onCustom,
  placeholder = 'Search…',
  allowCustom = true,
}: {
  items: PickerItem[];
  value?: string | null;
  values?: string[];
  multi?: boolean;
  onChange?: (id: string | null, item: PickerItem | null) => void;
  onChangeMulti?: (ids: string[], items: PickerItem[]) => void;
  onCustom?: (label: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [q, setQ] = useState('');
  const selected = new Set(multi ? (values || []) : (value ? [value] : []));
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items.slice(0, 40);
    return items.filter((it) => {
      const blob = `${it.name} ${it.label || ''} ${(it.aliases || []).join(' ')} ${it.manufacturer || ''}`.toLowerCase();
      return blob.includes(n);
    }).slice(0, 40);
  }, [items, q]);

  const toggle = (it: PickerItem) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(it.id)) next.delete(it.id);
      else next.add(it.id);
      const ids = Array.from(next);
      onChangeMulti?.(ids, items.filter((x) => ids.includes(x.id)));
    } else {
      onChange?.(it.id, it);
      setQ('');
    }
  };

  const selectedItems = items.filter((it) => selected.has(it.id));

  return (
    <View style={s.wrap}>
      {selectedItems.length > 0 && (
        <View style={s.chips}>
          {selectedItems.map((it) => (
            <TouchableOpacity key={it.id} style={s.chip} onPress={() => toggle(it)}>
              <Text style={s.chipTxt}>{it.label || it.name} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextInput
        style={s.input}
        value={q}
        onChangeText={setQ}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
      />
      {(q.length > 0 || multi) && (
        <ScrollView style={s.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {filtered.map((it) => (
            <TouchableOpacity key={it.id} style={[s.row, selected.has(it.id) && s.rowOn]} onPress={() => toggle(it)}>
              <Text style={s.rowTitle}>{it.label || it.name}</Text>
              {it.sub || it.manufacturer ? <Text style={s.rowSub}>{it.sub || [it.manufacturer, it.route, it.duration_years ? `${it.duration_years} yr` : ''].filter(Boolean).join(' · ')}</Text> : null}
            </TouchableOpacity>
          ))}
          {allowCustom && q.trim() && !filtered.some((it) => it.name.toLowerCase() === q.trim().toLowerCase()) ? (
            <TouchableOpacity style={s.row} onPress={() => { onCustom?.(q.trim()); setQ(''); }}>
              <Text style={s.custom}>Not in list — add “{q.trim()}” as custom</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.navy, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: FontSizes.md, color: Colors.text, backgroundColor: Colors.white },
  list: { maxHeight: 220, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.white },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowOn: { backgroundColor: Colors.tealBg },
  rowTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Colors.navy },
  rowSub: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  custom: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.coral },
});
