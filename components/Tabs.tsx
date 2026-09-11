import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts } from '@/constants/Fonts';

export type TabItem<T extends string = string> = { key: T; label: string };

type SegmentedProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
};

export function SegmentedTabs<T extends string>({ items, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={seg.wrap}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <TouchableOpacity
            key={item.key}
            style={[seg.btn, on && seg.btnOn]}
            onPress={() => onChange(item.key)}
            activeOpacity={0.85}
          >
            <Text style={[seg.txt, on && seg.txtOn]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type ChipProps<T extends string> = {
  items: TabItem<T>[];
  value: T | T[];
  onChange: (key: T) => void;
  accent?: 'navy' | 'coral';
  floating?: boolean;
  size?: 'md' | 'sm';
};

export function FilterChips<T extends string>({
  items,
  value,
  onChange,
  accent = 'navy',
  floating,
  size = 'md',
}: ChipProps<T>) {
  const selected = Array.isArray(value) ? value : [value];
  const activeBg = accent === 'coral' ? '#E85A50' : '#26265E';
  const compact = size === 'sm';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chip.row}>
      {items.map((item) => {
        const on = selected.includes(item.key);
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onChange(item.key)}
            activeOpacity={0.85}
            style={[
              chip.btn,
              compact && chip.btnSm,
              floating && chip.float,
              on
                ? { backgroundColor: activeBg, borderColor: activeBg }
                : { backgroundColor: '#fff', borderColor: '#E8EAF0' },
            ]}
          >
            <Text style={[chip.txt, compact && chip.txtSm, { color: on ? '#fff' : '#26265E' }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const seg = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#EFF1F5',
    borderRadius: 999,
    padding: 4,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  btnOn: { backgroundColor: '#26265E' },
  txt: { fontFamily: Fonts.bold, fontSize: 13.5, color: '#6B7280' },
  txtOn: { color: '#FFFFFF' },
});

const chip = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexGrow: 1 },
  btn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  btnSm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  txt: { fontFamily: Fonts.semibold, fontSize: 13 },
  txtSm: { fontSize: 12 },
});
