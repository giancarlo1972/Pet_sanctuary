import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Switch, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';
import { useAuth } from '@/lib/context/AuthContext';
import { useMeChrome } from '@/lib/context/MeChromeContext';
import { useSignedUrl } from '@/hooks/useSignedUrls';
import { ME_ROLE_COLOR, ME_ROLE_LABEL, type MeVisualRole } from '@/lib/me-chrome';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;

export default function AvatarButton() {
  const router = useRouter();
  const { user, signOut, realPlatform } = useAuth();
  const chrome = useMeChrome();
  const [sheet, setSheet] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const { url } = useSignedUrl(chrome.avatarUrl);
  const ring = ME_ROLE_COLOR[chrome.role] || Colors.coral;
  const count = chrome.pending > 9 ? '9+' : String(chrome.pending);

  const roles = useMemo(() => {
    const out: MeVisualRole[] = [];
    if (chrome.categories.includes('owner')) out.push('owner');
    if (chrome.categories.includes('provider')) out.push('provider');
    if (chrome.categories.includes('organization')) out.push('organization');
    if (realPlatform && !out.includes('platform')) out.push('platform');
    if (!out.length) out.push('owner');
    return out;
  }, [chrome.categories, realPlatform]);

  if (!user) {
    return (
      <TouchableOpacity style={styles.signIn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
        <Text style={styles.signInTxt}>Sign in</Text>
      </TouchableOpacity>
    );
  }

  const goMe = () => {
    setSheet(false);
    router.push('/(tabs)/profile');
  };

  const openSheet = () => {
    setHint(null);
    setSheet(true);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.hit}
        onPress={goMe}
        onLongPress={openSheet}
        delayLongPress={380}
        accessibilityLabel="Me"
        accessibilityHint="Tap for your profile. Long-press to switch role, go on duty, or sign out."
        activeOpacity={0.85}
        {...(Platform.OS === 'web'
          ? { onContextMenu: (e: any) => { e?.preventDefault?.(); openSheet(); } }
          : {})}
      >
        <View style={[styles.ring, { borderColor: ring }]}>
          {url ? (
            <Image source={{ uri: url }} style={styles.photo} />
          ) : (
            <View style={styles.initialsDisc}>
              <Text style={styles.initials}>{chrome.initials}</Text>
            </View>
          )}
        </View>
        {chrome.role === 'platform' ? (
          <View style={styles.shieldWrap}>
            <Shield color={Colors.white} fill={Colors.navy} size={11} />
          </View>
        ) : null}
        {chrome.onDuty ? <View style={styles.dutyDot} /> : null}
        {chrome.pending > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSheet(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHead}>
              <View style={[styles.ring, { borderColor: ring }]}>
                {url ? <Image source={{ uri: url }} style={styles.photo} /> : (
                  <View style={styles.initialsDisc}><Text style={styles.initials}>{chrome.initials}</Text></View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName} numberOfLines={1}>{chrome.name || chrome.email || 'You'}</Text>
                <Text style={styles.sheetRole}>{ME_ROLE_LABEL[chrome.role]}{chrome.onDuty ? ' · On duty' : ''}</Text>
              </View>
            </View>

            <Text style={styles.kicker}>Switch role</Text>
            <View style={styles.roleRow}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, chrome.role === r && { backgroundColor: ME_ROLE_COLOR[r], borderColor: ME_ROLE_COLOR[r] }]}
                  onPress={() => { void chrome.setRole(r); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.roleChipTxt, chrome.role === r && { color: Colors.white }]}>{ME_ROLE_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dutyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dutyLabel}>On duty</Text>
                <Text style={styles.dutyHint}>Visible to nearby members for 8 hours</Text>
              </View>
              <Switch
                value={chrome.onDuty}
                onValueChange={async () => {
                  const res = await chrome.toggleDuty();
                  if (!res.ok) {
                    setHint(res.message || 'Could not update.');
                    if (/Pick a service/i.test(res.message || '')) {
                      setSheet(false);
                      router.push('/(tabs)/profile');
                    }
                  } else setHint(null);
                }}
                trackColor={{ false: Colors.borderInput, true: Colors.teal }}
                thumbColor={Colors.white}
              />
            </View>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}

            <TouchableOpacity
              style={styles.signOut}
              onPress={async () => { setSheet(false); await signOut(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.signOutTxt}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hit: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', ...(Platform.OS === 'web' ? { userSelect: 'none' as const, cursor: 'pointer' as const } : {}) },
  ring: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, overflow: 'hidden',
    backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center',
  },
  photo: { width: 32, height: 32, borderRadius: 16 },
  initialsDisc: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#26265E',
    justifyContent: 'center', alignItems: 'center',
  },
  initials: {
    color: Colors.white, fontSize: 13, fontFamily: INTER, fontWeight: '800' as const,
  },
  dutyDot: {
    position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.teal, borderWidth: 2, borderColor: Colors.white,
  },
  shieldWrap: {
    position: 'absolute', left: -1, bottom: -1, width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: -3, right: -4, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.white,
  },
  badgeTxt: { color: Colors.white, fontSize: 9, fontFamily: INTERB, fontWeight: '700' as const, lineHeight: 11 },
  signIn: { backgroundColor: Colors.coral, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  signInTxt: { fontSize: 13, fontFamily: INTERB, fontWeight: '700' as const, color: Colors.white },
  overlay: { flex: 1, backgroundColor: 'rgba(38,38,94,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 },
  sheet: {
    width: 280, backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: Colors.navy, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetName: { fontFamily: INTERB, fontWeight: '800' as const, fontSize: 15, color: Colors.navy },
  sheetRole: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  kicker: { fontFamily: INTERB, fontWeight: '700' as const, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.surface },
  roleChipTxt: { fontFamily: INTERB, fontWeight: '700' as const, fontSize: 12, color: Colors.navy },
  dutyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  dutyLabel: { fontFamily: INTERB, fontWeight: '700' as const, fontSize: 14, color: Colors.navy },
  dutyHint: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.coral },
  signOut: { backgroundColor: Colors.coralBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  signOutTxt: { fontFamily: INTERB, fontWeight: '800' as const, fontSize: 14, color: Colors.coral },
});
