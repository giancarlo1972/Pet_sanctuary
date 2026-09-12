import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PawPrint } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import SignInPrompt from '@/components/SignInPrompt';
import { InlineBanner } from '@/components/InlineBanner';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignedImage from '@/components/SignedImage';
import { isUsablePhoto } from '@/lib/photos';
import MyReportRow from '@/components/MyReportRow';
import { type MyReport, loadMyReports } from '@/lib/my-reports';

type PetRow = { id: string; name: string | null; main_photo_url: string | null; species: string | null };
type AppRow = { id: string; pet_name: string; status: string; application_type: string };
type FosterRow = { id: string; name: string; species: string | null };

export default function ManageScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myPets, setMyPets] = useState<PetRow[]>([]);
  const [myApps, setMyApps] = useState<AppRow[]>([]);
  const [fosters, setFosters] = useState<FosterRow[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [myReports, setMyReports] = useState<MyReport[]>([]);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
    const { data: owned } = await supabase.from('pets').select('id, name, main_photo_url, species').eq('owner_id', user.id).limit(40);
    const { data: rels } = await supabase.from('pet_relationships').select('pet_id, relationship').eq('user_id', user.id).is('ended_on', null);
    const extraIds = (rels || []).map((x: any) => x.pet_id).filter((id: string) => !(owned || []).some((p) => p.id === id));
    let related: PetRow[] = [];
    if (extraIds.length) {
      const { data } = await supabase.from('pets').select('id, name, main_photo_url, species').in('id', extraIds);
      related = (data as PetRow[]) || [];
    }
    setMyPets(([...(owned || []), ...related]) as PetRow[]);

    const fosterIds = (rels || []).filter((r: any) => /foster/i.test(r.relationship || '')).map((r: any) => r.pet_id);
    const fosterPets = [...(owned || []), ...related].filter((p) => fosterIds.includes(p.id));
    setFosters(fosterPets.map((p) => ({ id: p.id, name: p.name || 'Pet', species: p.species })));

    const { data: apps } = await supabase.from('my_applications').select('id, application_type, status, pet_id').order('created_at', { ascending: false }).limit(40);
    const petIds = [...new Set(((apps || []) as any[]).map((a) => a.pet_id).filter(Boolean))];
    const { data: named } = petIds.length ? await supabase.from('pets').select('id, name').in('id', petIds) : { data: [] as any[] };
    const nmap: Record<string, string> = {};
    (named || []).forEach((p: any) => { nmap[p.id] = p.name; });
    setMyApps(((apps || []) as any[]).map((a) => ({
      id: a.id, status: a.status, application_type: a.application_type, pet_name: nmap[a.pet_id] || 'Pet',
    })));

    const { data: duty } = await supabase.from('helper_status').select('services, on_duty').eq('user_id', user.id).maybeSingle();
    setServices((((duty as any)?.services) || []) as string[]);

    try {
      setMyReports(await loadMyReports(user.id));
    } catch {
      setMyReports([]);
    }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  if (!user) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Manage" showBack />
        {authLoading ? null : (
          <SignInPrompt title="Sign in to manage" message="Pets, applications, and on-duty settings are on your account." />
        )}
      </SafeAreaView>
    );
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Manage" showBack />
        <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Manage" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}

        <Text style={styles.kicker}>My Pets</Text>
        {myPets.length === 0 ? <Text style={styles.meta}>No pets yet.</Text> : null}
        {myPets.map((p) => (
          <TouchableOpacity key={p.id} style={styles.row} onPress={() => router.push(`/pet-record?petId=${p.id}`)}>
            {isUsablePhoto(p.main_photo_url) ? <SignedImage path={p.main_photo_url} style={styles.thumb} /> : (
              <View style={[styles.thumb, styles.thumbFallback]}><PawPrint color={Colors.textTertiary} size={16} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name || 'Unnamed'}</Text>
              <Text style={styles.meta}>{p.species || 'Pet'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.ghost} onPress={() => router.push('/add-pet')}><Text style={styles.ghostTxt}>Add a pet</Text></TouchableOpacity>

        <Text style={styles.kicker}>My Reports</Text>
        {myReports.length === 0 ? <Text style={styles.meta}>No reports filed yet.</Text> : null}
        {myReports.slice(0, 8).map((r) => <MyReportRow key={r.id} report={r} />)}
        <TouchableOpacity style={styles.ghost} onPress={() => router.push('/reports-tracking')}><Text style={styles.ghostTxt}>See all reports</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ghost} onPress={() => router.push('/report')}><Text style={styles.ghostTxt}>File a report</Text></TouchableOpacity>

        <Text style={styles.kicker}>My Applications</Text>
        {myApps.length === 0 ? <Text style={styles.meta}>No applications yet.</Text> : null}
        {myApps.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.pet_name}</Text>
              <Text style={styles.meta}>{a.application_type} · {a.status}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.kicker}>My Fosters</Text>
        {fosters.length === 0 ? <Text style={styles.meta}>No foster placements yet.</Text> : null}
        {fosters.map((p) => (
          <TouchableOpacity key={p.id} style={styles.row} onPress={() => router.push(`/pet-record?petId=${p.id}`)}>
            <PawPrint color={Colors.navy} size={16} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{p.species || 'Foster'}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.kicker}>My Services</Text>
        {services.length === 0 ? <Text style={styles.meta}>No helper services listed yet.</Text> : null}
        {services.map((s) => (
          <View key={s} style={styles.row}>
            <Text style={styles.name}>{s.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  sub: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, gap: 4 },
  thumb: { width: 40, height: 40, borderRadius: 20 },
  thumbFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  ghost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 8, backgroundColor: Colors.white },
  ghostTxt: { fontFamily: Fonts.bold, color: Colors.navy },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  ok: { fontFamily: Fonts.bold, color: Colors.tealDark },
  no: { fontFamily: Fonts.bold, color: Colors.critical },
});
