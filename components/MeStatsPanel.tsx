import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Fonts } from '@/constants/Fonts';
import type { RoleCategory } from '@/lib/role-categories';
import { ROLE_CARDS } from '@/lib/role-categories';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTER6 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.semibold;
const INTER8 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

const VIEW_HEAD: Record<RoleCategory, string> = {
  owner: 'I AM AN OWNER',
  provider: 'I AM A SERVICE PROVIDER',
  organization: 'I AM AN ORGANIZATION',
  campaign: 'I AM A CAMPAIGN MANAGER',
};

export default function MeStatsPanel({
  view,
  pets,
  services,
  friends,
  setMe2Tab,
}: {
  view: RoleCategory;
  pets: number;
  services: number;
  friends: number;
  setMe2Tab: (label: string) => void;
}) {
  const pill = ROLE_CARDS.find((c) => c.key === view)?.title || 'Owner';
  const tiles = [
    { label: 'Pets', value: pets, tab: 'My Pets' },
    { label: 'Services & Volunteering', value: services, tab: 'My Services' },
    { label: 'Friends at Rescue Army', value: friends, tab: 'Friends' },
  ];
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.kicker}>{VIEW_HEAD[view]}</Text>
        <View style={s.pill}><Text style={s.pillTxt}>{pill}</Text></View>
      </View>
      <View style={s.row}>
        {tiles.map((t) => (
          <Pressable key={t.label} style={s.tile} onPress={() => setMe2Tab(t.tab)}>
            <Text style={s.value}>{t.value}</Text>
            <Text style={s.label}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#26265E',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  kicker: {
    fontFamily: INTER8,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#B9BCE0',
    flex: 1,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pillTxt: {
    fontFamily: INTER6,
    fontWeight: '600',
    fontSize: 10.5,
    color: '#fff',
  },
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  value: {
    fontFamily: INTER8,
    fontWeight: '800',
    fontSize: 22,
    color: '#fff',
  },
  label: {
    fontFamily: INTER6,
    fontWeight: '600',
    fontSize: 10.5,
    color: '#B9BCE0',
    textAlign: 'center',
    marginTop: 4,
  },
});
