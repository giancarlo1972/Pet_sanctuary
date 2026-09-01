import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Flag,
  Share2,
  PawPrint,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import type { Story } from '@/types';
import SignedImage from '@/components/SignedImage';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeAgo(dateString: string | null): string {
  if (!dateString) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const STORY_TYPE_LABELS: Record<string, string> = {
  adoption: 'Adoption',
  foster: 'Foster',
  rescue: 'Rescue',
  reunion: 'Reunion',
  memorial: 'Memorial',
  update: 'Update',
};

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const galleryItemSize = (screenWidth - 40 - 16) / 3;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id, author_id, organization_id, pet_id, title, body,
          cover_photo_url, photo_urls, story_type, status,
          published_at, created_at, updated_at,
          profiles!inner(full_name, avatar_url),
          organizations(name, logo_url),
          pets(name, main_photo_url)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) { setLoadError('Could not load this story.'); setLoading(false); return; }
      if (!data) { setLoadError('Story not found.'); setLoading(false); return; }
      const profile = data.profiles as any;
      const org = data.organizations as any;
      const pet = data.pets as any;
      setStory({
        id: data.id,
        author_id: data.author_id,
        organization_id: data.organization_id,
        pet_id: data.pet_id,
        title: data.title,
        body: data.body,
        cover_photo_url: data.cover_photo_url,
        photo_urls: data.photo_urls || [],
        story_type: data.story_type,
        status: data.status,
        published_at: data.published_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author_name: profile?.full_name || null,
        author_avatar: profile?.avatar_url || null,
        org_name: org?.name || null,
        org_logo: org?.logo_url || null,
        pet_name: pet?.name || null,
        pet_photo: pet?.main_photo_url || null,
      });
    } catch {
      setLoadError('Could not load this story.');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwner = user && story && user.id === story.author_id;

  const handleDelete = () => {
    setMenuVisible(false);
    setConfirmConfig({
      title: 'Delete story?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await supabase.from('stories').delete().eq('id', id);
          router.back();
        } catch (err) {
          console.error('[story-details] delete failed:', err);
          setBanner({ message: 'Could not delete the story. Please try again.', kind: 'error' });
        }
      },
    });
  };

  const handleReport = async () => {
    setReporting(true);
    try {
      const { error } = await supabase.from('story_reports').insert({
        story_id: id,
        reason: reportReason.trim() || null,
      });
      if (error) throw error;
      setReportModalVisible(false);
      setReportReason('');
      setBanner({ message: 'Thank you. Our team will review this story.', kind: 'success' });
    } catch (err) {
      console.error('[story-details] report failed:', err);
      setBanner({ message: 'Could not submit report. Please try again.', kind: 'error' });
    }
    setReporting(false);
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await Share.share({ message: `${story?.title} — Rescue Army` });
    } catch { /* ignore */ }
  };

  const allPhotos = story
    ? [story.cover_photo_url, ...story.photo_urls].filter(Boolean) as string[]
    : [];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  if (loadError || !story) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>{loadError || 'Story not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayName = story.org_name || story.author_name || 'Rescue Army';
  const displayAvatar = story.org_logo || story.author_avatar;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Story</Text>
        <TouchableOpacity style={styles.topBtn} onPress={() => setMenuVisible(true)} activeOpacity={0.75}>
          <MoreVertical color={Colors.text} size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Full-bleed cover */}
        {story.cover_photo_url ? (
          <Image source={{ uri: story.cover_photo_url }} style={[styles.coverImage, { width: screenWidth }]} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImage, { width: screenWidth }, styles.coverFallback]}>
            <PawPrint color={Colors.white} size={48} />
          </View>
        )}

        <View style={styles.bodySection}>
          {/* Story type chip */}
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{STORY_TYPE_LABELS[story.story_type] || story.story_type}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{story.title}</Text>

          {/* Author row */}
          <View style={styles.authorRow}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Text style={styles.authorInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.authorDate}>{timeAgo(story.published_at || story.created_at)}</Text>
            </View>
          </View>

          {/* Body */}
          <Text style={styles.bodyText}>{story.body}</Text>

          {/* Photo gallery */}
          {story.photo_urls.length > 0 && (
            <View style={styles.gallery}>
              {story.photo_urls.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.galleryItem, { width: galleryItemSize, height: galleryItemSize }]}
                  onPress={() => setGalleryIndex(i + 1)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pet link card */}
          {story.pet_id && story.pet_name && (
            <TouchableOpacity
              style={styles.petCard}
              onPress={() => router.push(`/pet-details?id=${story.pet_id}`)}
              activeOpacity={0.85}
            >
              {story.pet_photo ? (
                <SignedImage path={story.pet_photo} style={styles.petCardPhoto} />
              ) : (
                <View style={[styles.petCardPhoto, styles.petCardPhotoFallback]}>
                  <PawPrint color={Colors.textTertiary} size={20} />
                </View>
              )}
              <View style={styles.petCardInfo}>
                <Text style={styles.petCardLabel}>Featured in this story</Text>
                <Text style={styles.petCardName}>{story.pet_name}</Text>
              </View>
              <ChevronRight color={Colors.textTertiary} size={18} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Overflow menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare} activeOpacity={0.75}>
              <Share2 color={Colors.navy} size={18} />
              <Text style={styles.menuItemText}>Share story</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); router.push(`/story-composer?editId=${id}`); }}
                activeOpacity={0.75}
              >
                <Pencil color={Colors.navy} size={18} />
                <Text style={styles.menuItemText}>Edit story</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete} activeOpacity={0.75}>
                <Trash2 color={Colors.critical} size={18} />
                <Text style={[styles.menuItemText, { color: Colors.critical }]}>Delete story</Text>
              </TouchableOpacity>
            )}
            {!isOwner && user && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); setReportModalVisible(true); }}
                activeOpacity={0.75}
              >
                <Flag color={Colors.critical} size={18} />
                <Text style={[styles.menuItemText, { color: Colors.critical }]}>Report this story</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report this story</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.reportInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Tell us why you're reporting this story..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reportSubmitBtn, reporting && { opacity: 0.6 }]}
              onPress={handleReport}
              disabled={reporting}
              activeOpacity={0.85}
            >
              {reporting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Submit report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo gallery viewer */}
      <Modal visible={galleryIndex !== null} transparent animationType="fade" onRequestClose={() => setGalleryIndex(null)}>
        <View style={styles.galleryViewer}>
          <TouchableOpacity style={styles.galleryClose} onPress={() => setGalleryIndex(null)}>
            <X color={Colors.white} size={24} />
          </TouchableOpacity>
          {galleryIndex !== null && allPhotos[galleryIndex] && (
            <Image
              source={{ uri: allPhotos[galleryIndex] }}
              style={[styles.galleryFullImage, { width: screenWidth, height: screenWidth }]}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  centered: { justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, flex: 1, textAlign: 'center' },

  scrollContent: { paddingBottom: 60 },

  coverImage: { height: 280 },
  coverFallback: { backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center' },

  bodySection: { padding: 20 },

  typeChip: {
    alignSelf: 'flex-start', backgroundColor: Colors.coral, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
  },
  typeChipText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.white, textTransform: 'uppercase', letterSpacing: 0.5 },

  title: { fontSize: FontSizes['2xl'], fontFamily: Fonts.extrabold, color: Colors.text, lineHeight: 30, marginBottom: 16 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorAvatarFallback: { backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  authorInitial: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },
  authorInfo: { flex: 1 },
  authorName: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  authorDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  bodyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 24, marginBottom: 24 },

  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  galleryItem: { borderRadius: 12, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%' },

  petCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  petCardPhoto: { width: 48, height: 48, borderRadius: 24 },
  petCardPhotoFallback: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  petCardInfo: { flex: 1 },
  petCardLabel: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary },
  petCardName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginTop: 2 },

  errorTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 12 },
  retryBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 32 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  menuItemText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },

  reportOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  reportCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reportTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  reportLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary, marginBottom: 6 },
  reportInput: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 80,
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.surface, textAlignVertical: 'top',
  },
  reportSubmitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  reportSubmitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },

  galleryViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  galleryClose: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  galleryFullImage: {},
});
