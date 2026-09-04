import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/hooks/useSafeBack';
import {
  ArrowLeft,
  Shield,
  Heart,
  Play,
  PawPrint,
  Check,
  Share as ShareIcon,
  Link as LinkIcon,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import SignedImage from '@/components/SignedImage';

const BRAND_COLORS = [Colors.coral, Colors.teal, Colors.navy, Colors.accent, Colors.coralDark, Colors.tealDark];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

interface OrgPet {
  id: string;
  name: string;
  photo_url: string | null;
}

interface OrgData {
  id: string;
  name: string;
  description: string;
  type: string;
  city: string;
  status: string;
  ein: string;
  ein_verified: boolean;
  tax_deductible: boolean;
  address: string;
  website: string;
  donation_url: string;
  contact_email: string;
  data_source: string;
  pets_listed: number;
  adoptions: number;
  followers: number;
  pets: OrgPet[];
}

const MOCK_ORG: OrgData = {
  id: 'demo',
  name: 'Happy Paws Shelter',
  description: '',
  type: 'Shelter',
  city: '',
  status: 'verified',
  ein: '',
  ein_verified: false,
  tax_deductible: false,
  address: '',
  website: '',
  donation_url: '',
  contact_email: '',
  data_source: 'Unknown',
  pets_listed: 0,
  adoptions: 0,
  followers: 0,
  pets: [],
};

const SHARE_CHIPS = [
  { label: 'The Dodo', icon: ShareIcon },
  { label: 'Instagram Reels', icon: ShareIcon },
  { label: 'TikTok', icon: ShareIcon },
  { label: 'Copy link', icon: LinkIcon },
];

function openDonate(org: OrgData) {
  const url =
    org.donation_url ||
    (org.contact_email
      ? `https://www.paypal.com/donate/?business=${encodeURIComponent(org.contact_email)}&currency_code=USD`
      : org.website);
  if (!url) return;
  Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
}

export default function OrganizationDetailsScreen() {
  const safeBack = useSafeBack('/(tabs)/community');
  const { id, story } = useLocalSearchParams();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [einDisplay, setEinDisplay] = useState<string | null>(null);
  const [einFullAccess, setEinFullAccess] = useState(false);

  useEffect(() => {
    (async () => {
      if (id) {
        try {
          const { data: dbOrg, error } = await supabase
            .from('organizations')
            .select('id, name, description, org_type, address, website, phone, contact_email, status, ein, ein_verified, tax_deductible, donations_enabled')
            .eq('id', id)
            .single();
          if (!error && dbOrg) {
            const orgTypeLabel: Record<string, string> = {
              nonprofit: 'Nonprofit',
              business: 'Business / Sponsor',
              municipal: 'Municipal',
              individual: 'Personal Fundraiser',
            };
            const cityMatch = dbOrg.address?.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/);
            setOrg({
              id: dbOrg.id,
              name: dbOrg.name || 'Organization',
              description: dbOrg.description || '',
              type: orgTypeLabel[dbOrg.org_type] || 'Organization',
              city: cityMatch?.[1] || '',
              status: dbOrg.status || 'pending',
              ein: dbOrg.ein || '',
              ein_verified: dbOrg.ein_verified || false,
              tax_deductible: dbOrg.tax_deductible || false,
              address: dbOrg.address || '',
              website: dbOrg.website || '',
              donation_url: '',
              contact_email: dbOrg.contact_email || '',
              data_source: 'User registered',
              pets_listed: 0,
              adoptions: 0,
              followers: 0,
              pets: [],
            });
            setLoading(false);
            return;
          }
        } catch { /* fall through to RescueGroups */ }

        try {
          const resp = await fetch('/api/rescuegroups?state=NY');
          const json = await resp.json();
          const d = (json.orgs || []).find((o: any) => o.id === id);
          if (d) {
            setOrg({
              id: d.id,
              name: d.name,
              description: d.description || d.website || '',
              type: d.org_type || 'Rescue',
              city: d.location || '',
              status: 'verified',
              ein: '',
              ein_verified: false,
              tax_deductible: false,
              address: d.location || '',
              website: d.website || '',
              donation_url: d.donation_url || '',
              contact_email: d.email || '',
              data_source: 'RescueGroups.org API',
              pets_listed: 0,
              adoptions: 0,
              followers: 0,
              pets: [],
            });
          } else {
            setOrg(MOCK_ORG);
          }
        } catch {
          setOrg(MOCK_ORG);
        }
      } else if (story) {
        setOrg(MOCK_ORG);
      } else {
        setOrg(MOCK_ORG);
      }
      setLoading(false);
    })();
  }, [id, story]);

  useEffect(() => {
    if (!org || !org.id || org.id === 'demo' || String(org.id).startsWith('rg-')) return;
    (async () => {
      try {
        const { data } = await supabase.rpc('get_org_ein', { p_org_id: org.id });
        if (data) {
          setEinDisplay(data);
          setEinFullAccess(!data.startsWith('••'));
        }
      } catch { /* ignore */ }
    })();
  }, [org]);

  const handleShare = async (label: string) => {
    if (label === 'Copy link') {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (url) {
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      }
      return;
    }
    try {
      await Share.share({ message: `Check out this rescue story from ${org?.name || ''}!` });
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (!org) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Organization not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const brandColor = colorForName(org.name);
  const canDonate = !!(org.donation_url || org.contact_email || org.website);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.navyHeader}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.backButton} onPress={safeBack}>
              <ArrowLeft color={Colors.white} size={22} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.headerOrgInfo}>
            <View style={[styles.orgInitialTile, { backgroundColor: brandColor }]}>
              <Text style={styles.orgInitialText}>{org.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerNameWrap}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName} numberOfLines={1}>{org.name}</Text>
                {org.status === 'approved' && org.ein_verified && (
                  <View style={styles.verifiedBadge}>
                    <Shield color={Colors.teal} size={12} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerMeta}>{org.type} · {org.city}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{org.pets_listed}</Text>
              <Text style={styles.statLabel}>Pets listed</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{org.adoptions.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Adoptions</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{org.followers.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {org.description ? (
            <Text style={styles.description}>{org.description}</Text>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Status</Text>
              <Text style={[styles.infoVal, { color: Colors.tealDark }]}>
                {org.status === 'approved' && org.ein_verified ? '501(c)(3) verified' : org.status === 'approved' ? 'Registered' : org.status === 'pending' ? 'Pending review' : 'Registered'}
              </Text>
            </View>
            {(einDisplay || org.ein) ? (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>EIN</Text>
                  <View style={styles.einRow}>
                    <Text style={styles.einValueMono}>{einDisplay || org.ein}</Text>
                    {!einFullAccess && (
                      <View style={styles.einPill}>
                        <Text style={styles.einPillText}>Members only</Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            ) : null}
            {org.address ? (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Address</Text>
                  <Text style={styles.infoVal} numberOfLines={2}>{org.address}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Data source</Text>
              <Text style={[styles.infoVal, { color: Colors.tealDark }]}>{org.data_source}</Text>
            </View>
          </View>

          {org.pets.length > 0 && (
            <View style={styles.petStripSection}>
              <Text style={styles.sectionTitle}>Available pets</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petStrip}>
                {org.pets.map((pet) => (
                  <TouchableOpacity
                    key={pet.id}
                    style={styles.petCard}
                    onPress={() => router.push(`/pet-details?id=${pet.id}`)}
                    activeOpacity={0.85}
                  >
                    {pet.photo_url ? (
                      <SignedImage path={pet.photo_url} style={styles.petCardImage} />
                    ) : (
                      <View style={[styles.petCardImage, styles.petCardFallback]}>
                        <PawPrint color={Colors.textTertiary} size={24} />
                      </View>
                    )}
                    <Text style={styles.petCardName} numberOfLines={1}>{pet.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {story ? (
            <View style={styles.storySection}>
              <View style={styles.storyHero}>
                <PawPrint color={Colors.white} size={40} />
                <View style={styles.storyPlayBtn}>
                  <Play color={Colors.white} size={28} fill={Colors.white} />
                </View>
              </View>
              <Text style={styles.storyTitle}>Rocky's incredible recovery after being found on the highway</Text>
              <Text style={styles.storyBody}>
                When we got the call about a dog hit by a car on the highway, we didn't know if he'd make it.
                Rocky had a broken leg, was malnourished, and terrified of people. After three months of
                surgery, rehabilitation, and love from our volunteers, Rocky is now thriving in his forever
                home. His story is a testament to what community support can do.
              </Text>
              <Text style={styles.storyShareLabel}>Share this rescue</Text>
              <View style={styles.shareChipsRow}>
                {SHARE_CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <TouchableOpacity
                      key={chip.label}
                      style={styles.shareChip}
                      onPress={() => handleShare(chip.label)}
                      activeOpacity={0.85}
                    >
                      <Icon color={Colors.coral} size={14} />
                      <Text style={styles.shareChipText}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.storyFootnote}>
                Sharing drives adoptions — stories shared to media partners reach an average of 40k viewers.
              </Text>
            </View>
          ) : null}
          <Text style={styles.donateDisclaimer}>
            Donations go directly to {org.name}. Rescue Army does not collect, hold, or process this money.
          </Text>
          {(org.donation_url || org.contact_email || org.website) ? (
            <View style={styles.donateOptions}>
              {org.donation_url ? (
                <TouchableOpacity style={styles.donateOption} onPress={() => Linking.openURL(org.donation_url.startsWith('http') ? org.donation_url : `https://${org.donation_url}`)}>
                  <Text style={styles.donateOptionText}>Donate on their page</Text>
                </TouchableOpacity>
              ) : null}
              {org.contact_email ? (
                <TouchableOpacity style={styles.donateOption} onPress={() => Linking.openURL(`https://www.paypal.com/donate/?business=${encodeURIComponent(org.contact_email)}&currency_code=USD`)}>
                  <Text style={styles.donateOptionText}>PayPal</Text>
                </TouchableOpacity>
              ) : null}
              {org.website ? (
                <TouchableOpacity style={styles.donateOption} onPress={() => Linking.openURL(org.website.startsWith('http') ? org.website : `https://${org.website}`)}>
                  <Text style={styles.donateOptionText}>Shelter website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={styles.donateDisclaimer}>This listing has no PayPal or donate link in RescueGroups yet.</Text>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followingBtn]}
              onPress={() => setFollowing(!following)}
              activeOpacity={0.85}
            >
              {following ? (
                <>
                  <Check color={Colors.white} size={16} />
                  <Text style={styles.followingText}>Following</Text>
                </>
              ) : (
                <Text style={styles.followText}>Follow</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.donateBtn, !canDonate && { opacity: 0.5 }]}
              onPress={() => openDonate(org)}
              activeOpacity={0.85}
            >
              <Heart color={Colors.white} size={16} />
              <Text style={styles.donateText}>Donate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSizes.lg, fontFamily: Fonts.semibold, color: Colors.critical },
  navyHeader: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  headerTopRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerOrgInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
  },
  orgInitialTile: {
    width: 54, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  orgInitialText: {
    fontSize: FontSizes['2xl'], fontFamily: Fonts.bold, color: Colors.white,
  },
  headerNameWrap: { flex: 1 },
  headerNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerName: {
    fontSize: FontSizes.xl, fontFamily: Fonts.extrabold, color: Colors.white,
  },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(46,158,150,0.2)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedText: {
    fontSize: 10, fontFamily: Fonts.bold, color: Colors.teal,
  },
  headerMeta: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.7)', marginTop: 4,
  },
  statRow: {
    flexDirection: 'row', gap: 10,
  },
  statTile: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  statValue: {
    fontSize: FontSizes['2xl'], fontFamily: Fonts.extrabold, color: Colors.white,
  },
  statLabel: {
    fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.7)', marginTop: 4,
  },
  body: { padding: 20, paddingBottom: 100 },
  description: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 22, marginBottom: 16,
  },
  infoCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10,
  },
  infoKey: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary,
  },
  infoVal: {
    fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, flexShrink: 1, textAlign: 'right',
  },
  infoDivider: { height: 1, backgroundColor: Colors.border },
  einRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  einValueMono: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, letterSpacing: 1 },
  einPill: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  einPillText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.textTertiary },
  sectionTitle: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 12,
  },
  petStripSection: { marginBottom: 24 },
  petStrip: { gap: 10, paddingBottom: 4 },
  petCard: {
    width: 110,
  },
  petCardImage: {
    width: 110, height: 96, borderRadius: 14, backgroundColor: Colors.surface,
  },
  petCardFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  petCardName: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text, marginTop: 6, textAlign: 'center',
  },
  storySection: { marginBottom: 24 },
  storyHero: {
    height: 250, borderRadius: 14, backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  storyPlayBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  storyTitle: {
    fontSize: 19, fontFamily: Fonts.extrabold, color: Colors.text, marginBottom: 12, lineHeight: 26,
  },
  storyBody: {
    fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 22, marginBottom: 20,
  },
  storyShareLabel: {
    fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 10,
  },
  shareChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  shareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  shareChipText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text,
  },
  storyFootnote: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row', gap: 12,
  },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.navy,
  },
  followText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy,
  },
  followingBtn: {
    backgroundColor: Colors.navy, borderColor: Colors.navy,
  },
  followingText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white,
  },
  donateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.coral,
  },
  donateText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white,
  },
    donateDisclaimer: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
    lineHeight: 18, marginBottom: 12, textAlign: 'center',
  },
  donateOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' },
  donateOption: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  donateOptionText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
});
