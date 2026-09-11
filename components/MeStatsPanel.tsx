import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Fonts } from '@/constants/Fonts';
import type { RoleCategory } from '@/lib/role-categories';
import { ROLE_CARDS } from '@/lib/role-categories';
import { DashboardPanel } from '@/components/DashboardPanel';

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
  return (
    <Pressable onPress={() => setMe2Tab('My Pets')}>
      <DashboardPanel
        header={(
          <View style={s.head}>
            <Text style={s.kicker}>{VIEW_HEAD[view]}</Text>
            <View style={s.pill}><Text style={s.pillTxt}>{pill}</Text></View>
          </View>
        )}
        tiles={[
          { label: 'Pets', value: pets },
          { label: 'Services & Volunteering', value: services },
          { label: 'Friends at Rescue Army', value: friends },
        ]}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
