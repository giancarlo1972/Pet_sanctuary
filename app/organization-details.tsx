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
  Shield,
  Heart,
  Play,
  PawPrint,
  Check,
  Share as ShareIcon,
  Link as LinkIcon,
  Phone,
  Mail,
  Globe,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignedImage from '@/components/SignedImage';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { DashboardPanel } from '@/components/DashboardPanel';
import { orgSection, orgTypeLabel, orgTileColor, orgListsPets, orgVerifyBadge, type OrgSection } from '@/lib/org-type';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORG_SELECT_FULL = 'id, name, description, org_type, address, city, state, website, phone, contact_email, status, ein_verified, tax_deductible, donations_enabled, donate_url, data_source, external_id, verification_method';
const ORG_SELECT_SLIM = 'id, name, description, org_type, address, city, state, website, phone, contact_email, status, ein_verified, data_source, external_id';

function isUuid(value: string) {
  return UUID_RE.test(value);
}

interface OrgPet {
  id: string;
  name: string;
  photo_url: string | null;
}

interface SponsoredItem {
  id: string;
  title: string;
  sub: string;
  orgId?: string | null;
}

interface OrgData {
  id: string;
  name: string;
  description: string;
  type: string;
  kind: OrgSection;
  city: string;
  status: string;
  ein: string;
  ein_verified: boolean;
  tax_deductible: boolean;
  verification_method: string;
  address: string;
  website: string;
  phone: string;
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
  kind: 'shelter',
  city: '',
  status: 'verified',
  ein: '',
  ein_verified: false,
  tax_deductible: false,
  verification_method: '',
  address: '',
  website: '',
  phone: '',
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

function mapDbOrg(dbOrg: any): OrgData {
  const city = dbOrg.city
    || (String(dbOrg.address || '').match(/,\s*([^,]+),\s*[A-Z]{2}/)?.[1])
    || '';
  const fromRg = String(dbOrg.data_source || '').toLowerCase().includes('rescue');
  const kind = orgSection(dbOrg.org_type);
  const description = dbOrg.description
    || (kind === 'sponsor' ? 'Helps shelters and animals in need.' : '');
  return {
    id: dbOrg.id,
    name: dbOrg.name || 'Organization',
    description,
    type: orgTypeLabel(dbOrg.org_type),
    kind,
    city,
    status: dbOrg.status || 'pending',
    ein: '',
    ein_verified: Boolean(dbOrg.ein_verified),
    tax_deductible: Boolean(dbOrg.tax_deductible),
    verification_method: dbOrg.verification_method || '',
    address: dbOrg.address || [dbOrg.city, dbOrg.state].filter(Boolean).join(', '),
    website: dbOrg.website || '',
    phone: dbOrg.phone || '',
    donation_url: dbOrg.donate_url || '',
    contact_email: dbOrg.contact_email || '',
    data_source: fromRg ? 'RescueGroups.org API' : 'User registered',
    pets_listed: 0,
    adoptions: 0,
    followers: 0,
    pets: [],
  };
}

function openHref(href: string) {
  if (!href) return;
  Linking.openURL(href).catch(() => {
    if (typeof window !== 'undefined') window.location.href = href;
  });
}

function websiteHref(url: string) {
  const t = String(url || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function phoneHref(phone: string) {
  const t = String(phone || '').trim();
  if (!t) return '';
  return `tel:${t.replace(/[^\d+]/g, '')}`;
}

async function loadOrgRow(rawId: string) {
  const id = String(rawId || '').trim();
  const attempts: Array<['id' | 'external_id', string]> = [];
  if (isUuid(id)) attempts.push(['id', id]);
  const stripped = id.replace(/^rg-/, '');
  const withPrefix = id.startsWith('rg-') ? id : (stripped ? `rg-${stripped}` : '');
  for (const val of [id, withPrefix, stripped]) {
    if (!val || isUuid(val)) continue;
    if (!attempts.some((a) => a[0] === 'external_id' && a[1] === val)) {
      attempts.push(['external_id', val]);
    }
  }
  let last = { data: null as any, error: null as any };
  for (const [column, value] of attempts) {
    let res = await supabase.from('organizations').select(ORG_SELECT_FULL).eq(column, value).maybeSingle();
    if (res.error) {
      res = await supabase.from('organizations').select(ORG_SELECT_SLIM).eq(column, value).maybeSingle();
    }
    last = res;
    if (!res.error && res.data) return res;
  }
  return last;
}

function openDonate(org: OrgData) {
  const url =
    org.donation_url ||
    (org.contact_email
      ? `https://www.paypal.com/donate/?business=${encodeURIComponent(org.contact_email)}&currency_code=USD`
      : org.website);
  if (!url) return;
  openHref(url.startsWith('http') ? url : `https://${url}`);
}

export default function OrganizationDetailsScreen() {
  const safeBack = useSafeBack('/(tabs)/community');
  const { user } = useAuth();
  const { id, story } = useLocalSearchParams();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [einDisplay, setEinDisplay] = useState<string | null>(null);
  const [einFullAccess, setEinFullAccess] = useState(false);
  const [sponsored, setSponsored] = useState<SponsoredItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rawId = String(Array.isArray(id) ? id[0] : id || '').trim();
        if (!rawId) {
          setOrg(null);
          return;
        }
        const { data: dbOrg, error } = await loadOrgRow(rawId);
        if (cancelled) return;
        if (error || !dbOrg) {
          setOrg(null);
          return;
        }
        const mapped = mapDbOrg(dbOrg);
        setOrg(mapped);
        const ext = dbOrg.external_id || (!isUuid(rawId) ? rawId : null);
        if (orgListsPets(dbOrg.org_type) && ext && String(ext).startsWith('rg-')) {
          fetch('/api/rescuegroups?org=' + encodeURIComponent(String(ext)))
            .then((r) => r.json())
            .then((petJson) => {
              if (cancelled) return;
              const pets = petJson.pets || [];
              setOrg((prev) => prev && prev.id === mapped.id
                ? { ...prev, pets, pets_listed: petJson.foundRows || pets.length }
                : prev);
            })
            .catch(() => { /* pets are optional */ });
        }
      } catch {
        if (!cancelled) setOrg(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!org || !org.id || org.id === 'demo' || !isUuid(String(org.id))) return;
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

  useEffect(() => {
    if (!org || org.kind !== 'sponsor' || !org.id || !isUuid(String(org.id))) {
      setSponsored([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: camps, error: cErr }, { data: funds, error: fErr }] = await Promise.all([
        supabase.from('campaigns').select('id, title, kind, status, org_id').eq('sponsor_id', org.id).limit(20),
        supabase.from('care_funds').select('id, name, org_id, active').eq('sponsor_id', org.id).limit(20),
      ]);
      if (cancelled) return;
      const rows: { id: string; title: string; sub: string; orgId?: string | null }[] = [];
      if (!cErr) {
        for (const c of camps || []) {
          rows.push({
            id: 'c-' + c.id,
            title: c.title || 'Campaign',
            sub: [c.kind, c.status].filter(Boolean).join(' · '),
            orgId: c.org_id,
          });
        }
      }
      if (!fErr) {
        for (const f of funds || []) {
          rows.push({
            id: 'f-' + f.id,
            title: f.name || 'Care Fund',
            sub: f.active === false ? 'Care Fund · inactive' : 'Care Fund',
            orgId: f.org_id,
          });
        }
      }
      const orgIds = [...new Set(rows.map((r) => r.orgId).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (orgIds.length) {
        const { data: named } = await supabase.from('organizations').select('id, name').in('id', orgIds);
        (named || []).forEach((o: any) => { names[o.id] = o.name; });
      }
      if (cancelled) return;
      setSponsored(rows.map((r) => ({
        ...r,
        sub: [r.sub, r.orgId ? names[r.orgId] : null].filter(Boolean).join(' · '),
      })));
    })();
    return () => { cancelled = true; };
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Organization" showBack />
        <Page>
          <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
        </Page>
      </SafeAreaView>
    );
  }

  if (!org) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Organization" showBack />
        <Page>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Organization not found</Text>
            <TouchableOpacity style={styles.errorBackBtn} onPress={safeBack} activeOpacity={0.85}>
              <Text style={styles.errorBackText}>Back</Text>
            </TouchableOpacity>
          </View>
        </Page>
      </SafeAreaView>
    );
  }

  const brandColor = orgTileColor(org.kind);
  const acceptsDonations = org.kind === 'shelter' || org.kind === 'rescue' || org.kind === 'clinic';
  const canDonate = acceptsDonations && !!(org.donation_url || org.contact_email || org.website);
  const listsPets = org.kind === 'shelter' || org.kind === 'rescue';
  const websiteCta = org.kind === 'clinic' ? 'Clinic website' : 'Shelter website';
  const isSponsor = org.kind === 'sponsor';
  const verify = orgVerifyBadge(org);
  const statusLabel = isSponsor
    ? (org.status === 'approved' ? 'Verified sponsor' : 'Pending')
    : verify.label;

  const partnerMailto = org.contact_email
    ? `mailto:${org.contact_email}?subject=${encodeURIComponent('Become a partner with ' + org.name)}`
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={org.name} showBack />
      <Page>
        <View style={styles.navyHeader}>
          <View style={styles.headerOrgInfo}>
            <View style={[styles.orgInitialTile, { backgroundColor: brandColor }]}>
              <Text style={styles.orgInitialText}>{org.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerNameWrap}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName} numberOfLines={1}>{org.name}</Text>
                {verify.teal && (
                  <View style={styles.verifiedBadge}>
                    <Shield color={Colors.teal} size={12} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerMeta}>{org.type}{org.city ? ` · ${org.city}` : ''}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            {listsPets ? (
              <DashboardPanel
                tiles={[
                  { label: 'Pets listed', value: org.pets_listed },
                  { label: 'Adoptions', value: org.adoptions.toLocaleString() },
                  { label: 'Followers', value: org.followers.toLocaleString() },
                ]}
              />
            ) : (
              <View style={styles.roleBanner}>
                <Text style={styles.roleBannerKicker}>
                  {org.kind === 'clinic' ? 'CLINIC' : isSponsor ? 'SPONSOR' : 'ORGANIZATION'}
                </Text>
                <Text style={styles.roleBannerText}>
                  {org.kind === 'clinic'
                    ? 'Emergency partner'
                    : isSponsor
                      ? 'Supports Rescue Army shelters & animals'
                      : org.type}
                </Text>
              </View>
            )}
          </View>
        </View>

        {org.description ? (
          <Text style={styles.description}>{org.description}</Text>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Status</Text>
            <Text style={[styles.infoVal, { color: Colors.tealDark }]}>
              {statusLabel}
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

          {(org.phone || org.contact_email || org.website) ? (
            <View style={styles.contactRow}>
              {org.phone ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => openHref(phoneHref(org.phone))} activeOpacity={0.85}>
                  <Phone color={Colors.coral} size={16} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
              ) : null}
              {org.contact_email ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => openHref(`mailto:${org.contact_email}`)} activeOpacity={0.85}>
                  <Mail color={Colors.coral} size={16} />
                  <Text style={styles.contactBtnText}>Email</Text>
                </TouchableOpacity>
              ) : null}
              {org.website ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => openHref(websiteHref(org.website))} activeOpacity={0.85}>
                  <Globe color={Colors.coral} size={16} />
                  <Text style={styles.contactBtnText}>Website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {listsPets && org.pets.length > 0 && (
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
                      pet.photo_url.startsWith('http') ? (
                        <Image source={{ uri: pet.photo_url }} style={styles.petCardImage} />
                      ) : (
                        <SignedImage path={pet.photo_url} style={styles.petCardImage} />
                      )
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

          {acceptsDonations ? (
            <>
              <Text style={styles.donateDisclaimer}>
                Donations go directly to {org.name}. Rescue Army does not collect, hold, or process this money.
              </Text>
              {(org.donation_url || org.contact_email || org.website) ? (
                <View style={styles.donateOptions}>
                  {org.donation_url ? (
                    <TouchableOpacity style={styles.donateOption} onPress={() => openHref(websiteHref(org.donation_url))}>
                      <Text style={styles.donateOptionText}>Donate on their page</Text>
                    </TouchableOpacity>
                  ) : null}
                  {org.contact_email ? (
                    <TouchableOpacity style={styles.donateOption} onPress={() => openHref(`https://www.paypal.com/donate/?business=${encodeURIComponent(org.contact_email)}&currency_code=USD`)}>
                      <Text style={styles.donateOptionText}>PayPal</Text>
                    </TouchableOpacity>
                  ) : null}
                  {org.website ? (
                    <TouchableOpacity style={styles.donateOption} onPress={() => openHref(websiteHref(org.website))}>
                      <Text style={styles.donateOptionText}>{websiteCta}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.donateDisclaimer}>This listing has no PayPal or donate link in RescueGroups yet.</Text>
              )}
            </>
          ) : isSponsor ? (
            <View style={styles.sponsorBlock}>
              <Text style={styles.sponsorKicker}>SPONSOR</Text>
              <Text style={styles.sponsorLine}>Supports Rescue Army shelters & animals</Text>
              {sponsored.length ? sponsored.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={styles.sponsorRow}
                  onPress={() => row.orgId && router.push(`/organization-details?id=${row.orgId}`)}
                  activeOpacity={row.orgId ? 0.85 : 1}
                  disabled={!row.orgId}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sponsorTitle} numberOfLines={1}>{row.title}</Text>
                    <Text style={styles.sponsorSub} numberOfLines={1}>{row.sub}</Text>
                  </View>
                </TouchableOpacity>
              )) : (
                <Text style={styles.sponsorEmpty}>No sponsored campaigns yet</Text>
              )}
              <TouchableOpacity
                style={[styles.partnerBtn, !partnerMailto && { opacity: 0.45 }]}
                onPress={() => partnerMailto && openHref(partnerMailto)}
                activeOpacity={0.85}
                disabled={!partnerMailto}
              >
                <Text style={styles.partnerBtnText}>Become a partner</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followingBtn]}
              onPress={() => {
                if (!user) { router.push('/auth'); return; }
                setFollowing(!following);
              }}
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
            {acceptsDonations ? (
              <TouchableOpacity
                style={[styles.donateBtn, !canDonate && { opacity: 0.5 }]}
                onPress={() => openDonate(org)}
                activeOpacity={0.85}
              >
                <Heart color={Colors.white} size={16} />
                <Text style={styles.donateText}>Donate</Text>
              </TouchableOpacity>
            ) : null}
          </View>
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { padding: 24, alignItems: 'center' },
  errorText: { fontSize: FontSizes.lg, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 16, textAlign: 'center' },
  errorBackBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  errorBackText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  navyHeader: {
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 16,
  },
  headerOrgInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
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
  roleBanner: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
  },
  roleBannerKicker: {
    fontSize: 11, fontFamily: Fonts.bold, color: Colors.accent, letterSpacing: 1.2,
  },
  roleBannerText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.white, marginTop: 4, textAlign: 'center',
  },
  description: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 22,
  },
  infoCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
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
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  contactBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy },
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
  sponsorBlock: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#D9DCE6', gap: 10,
  },
  sponsorKicker: {
    fontSize: 11, fontFamily: Fonts.extrabold, letterSpacing: 0.8, color: Colors.textTertiary,
  },
  sponsorLine: {
    fontSize: 14, fontFamily: Fonts.semibold, color: Colors.navy,
  },
  sponsorRow: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
  },
  sponsorTitle: { fontSize: 13.5, fontFamily: Fonts.bold, color: Colors.navy },
  sponsorSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  sponsorEmpty: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  partnerBtn: {
    marginTop: 4, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  partnerBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy },
});
