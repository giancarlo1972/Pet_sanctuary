import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  Camera,
  X,
  PawPrint,
  Check,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import type { StoryType } from '@/types';
import { extFromAsset } from '@/lib/storage';

const STORY_TYPES: { id: StoryType; label: string }[] = [
  { id: 'adoption', label: 'Adoption' },
  { id: 'foster', label: 'Foster' },
  { id: 'rescue', label: 'Rescue' },
  { id: 'reunion', label: 'Reunion' },
  { id: 'memorial', label: 'Memorial' },
  { id: 'update', label: 'Update' },
];

const MAX_PHOTOS = 6;

interface PetOption {
  pet_id: string;
  pet_name: string;
  pet_photo: string | null;
}

export default function StoryComposerScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { user } = useAuth();
  const isEditing = !!editId;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [storyType, setStoryType] = useState<StoryType>('rescue');
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoAssets, setPhotoAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [petOptions, setPetOptions] = useState<PetOption[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('pet_relationships')
          .select('pet_id, pets!inner(name, main_photo_url)')
          .eq('user_id', user.id);
        if (data) {
          setPetOptions(data.map((r: any) => ({
            pet_id: r.pet_id,
            pet_name: r.pets?.name || 'Unknown',
            pet_photo: r.pets?.main_photo_url || null,
          })));
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!editId) return;
    (async () => {
      setLoadingExisting(true);
      try {
        const { data, error } = await supabase
          .from('stories')
          .select('id, title, body, story_type, cover_photo_url, photo_urls, pet_id, status')
          .eq('id', editId)
          .maybeSingle();
        if (error || !data) { setError('Could not load story for editing.'); setLoadingExisting(false); return; }
        setTitle(data.title || '');
        setBody(data.body || '');
        setStoryType(data.story_type as StoryType);
        setCoverPhoto(data.cover_photo_url || null);
        setPhotos(data.photo_urls || []);
        setSelectedPetId(data.pet_id || null);
      } catch {
        setError('Could not load story for editing.');
      }
      setLoadingExisting(false);
    })();
  }, [editId]));

  const pickCoverPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setCoverPhoto(result.assets[0].uri);
        setCoverAsset(result.assets[0]);
      }
    } catch { /* ignore */ }
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotos((prev) => [...prev, asset.uri]);
        setPhotoAssets((prev) => [...prev, asset]);
      }
    } catch { /* ignore */ }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset, storyId: string): Promise<string> => {
    const ext = extFromAsset(asset);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `stories/${storyId}/${fileName}`;
    const mime = asset.mimeType || 'image/jpeg';
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('pet-photos')
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) {
      console.error('[story-composer] upload failed:', error.message, error.statusCode, error);
      throw error;
    }
    const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (publish: boolean) => {
    if (!user) { router.push('/auth'); return; }
    if (!title.trim() || !body.trim()) {
      setError('Please add a title and body for your story.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const basePayload = {
        author_id: user.id,
        title: title.trim(),
        body: body.trim(),
        story_type: storyType,
        pet_id: selectedPetId,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      };

      let storyId: string;

      if (isEditing && editId) {
        storyId = editId;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('stories')
          .insert({ ...basePayload, cover_photo_url: null, photo_urls: [] })
          .select('id')
          .single();
        if (insertError) throw insertError;
        storyId = inserted.id;
      }

      let coverUrl = coverPhoto;
      let photoWarning = false;

      if (coverAsset && coverPhoto && !coverPhoto.startsWith('http')) {
        try {
          coverUrl = await uploadImage(coverAsset, storyId);
        } catch (err) {
          console.error('[story-composer] cover upload failed:', err);
          coverUrl = null;
          photoWarning = true;
        }
      }

      const uploadedPhotos: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].startsWith('http')) {
          uploadedPhotos.push(photos[i]);
        } else {
          const asset = photoAssets[i];
          if (asset) {
            try {
              uploadedPhotos.push(await uploadImage(asset, storyId));
            } catch (err) {
              console.error('[story-composer] photo upload failed:', err);
              photoWarning = true;
            }
          }
        }
      }

      const { error: updateError } = await supabase
        .from('stories')
        .update({ ...basePayload, cover_photo_url: coverUrl, photo_urls: uploadedPhotos })
        .eq('id', storyId);
      if (updateError) throw updateError;

      if (photoWarning) {
        setError('Your story was saved, but some photos could not be uploaded. You can edit and try adding them again.');
        setSaving(false);
        return;
      }

      router.replace('/(tabs)/community');
    } catch (err) {
      console.error('[story-composer] save failed:', err);
      setError('Could not save your story. Please try again.');
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isEditing ? 'Edit Story' : 'Share Your Story'}</Text>
        <View style={styles.topBtnPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Cover photo */}
          <Text style={styles.fieldLabel}>Cover photo</Text>
          <TouchableOpacity style={styles.coverPicker} onPress={pickCoverPhoto} activeOpacity={0.85}>
            {coverPhoto ? (
              <Image source={{ uri: coverPhoto }} style={styles.coverPreview} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Camera color={Colors.textTertiary} size={28} />
                <Text style={styles.coverPlaceholderText}>Add a cover photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Give your story a title..."
            placeholderTextColor={Colors.textTertiary}
            maxLength={120}
            accessibilityLabel="Story title"
            accessibilityRole="text"
          />

          {/* Story type */}
          <Text style={styles.fieldLabel}>Story type</Text>
          <View style={styles.typeRow}>
            {STORY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, storyType === t.id && styles.typeChipActive]}
                onPress={() => setStoryType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeChipText, storyType === t.id && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Body */}
          <Text style={styles.fieldLabel}>Your story</Text>
          <TextInput
            style={[styles.bodyInput, { paddingTop: 12 }]}
            value={body}
            onChangeText={setBody}
            placeholder="Share the journey — what happened, how it felt, the outcome..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Story body"
            accessibilityRole="text"
          />

          {/* Photos */}
          <Text style={styles.fieldLabel}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
          <View style={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImg} />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => { setPhotos((prev) => prev.filter((_, idx) => idx !== i)); setPhotoAssets((prev) => prev.filter((_, idx) => idx !== i)); }}
                >
                  <X color={Colors.white} size={12} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity style={styles.photoAddBtn} onPress={pickPhoto} activeOpacity={0.85}>
                <Camera color={Colors.textTertiary} size={20} />
              </TouchableOpacity>
            )}
          </View>

          {/* Pet link */}
          {petOptions.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Link to one of your pets (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petScrollRow}>
                <TouchableOpacity
                  style={[styles.petChip, !selectedPetId && styles.petChipActive]}
                  onPress={() => setSelectedPetId(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.petChipText, !selectedPetId && styles.petChipTextActive]}>None</Text>
                </TouchableOpacity>
                {petOptions.map((p) => (
                  <TouchableOpacity
                    key={p.pet_id}
                    style={[styles.petChip, selectedPetId === p.pet_id && styles.petChipActive]}
                    onPress={() => setSelectedPetId(p.pet_id)}
                    activeOpacity={0.8}
                  >
                    {p.pet_photo ? (
                      <Image source={{ uri: p.pet_photo }} style={styles.petChipPhoto} />
                    ) : (
                      <View style={[styles.petChipPhoto, styles.petChipPhotoFallback]}>
                        <PawPrint color={Colors.textTertiary} size={12} />
                      </View>
                    )}
                    <Text style={[styles.petChipText, selectedPetId === p.pet_id && styles.petChipTextActive]}>
                      {p.pet_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(false)}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(true)}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Check color={Colors.white} size={16} />
                <Text style={styles.publishBtnText}>{isEditing ? 'Update' : 'Publish'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  centered: { justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topBtnPlaceholder: { width: 40 },
  topTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text },

  scrollContent: { padding: 20, paddingBottom: 120 },

  fieldLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },

  coverPicker: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  coverPreview: { width: '100%', height: 180, borderRadius: 14 },
  coverPlaceholder: {
    height: 120, borderWidth: 1.5, borderColor: Colors.borderInput, borderStyle: 'dashed',
    borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  coverPlaceholderText: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary },

  titleInput: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.lg,
    fontFamily: Fonts.semibold, color: Colors.text, backgroundColor: Colors.white,
  },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  typeChipText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white, fontFamily: Fonts.bold },

  bodyInput: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 140,
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.white, textAlignVertical: 'top',
  },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { position: 'relative', width: 76, height: 76, borderRadius: 10, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemoveBtn: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  photoAddBtn: {
    width: 76, height: 76, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.borderInput, justifyContent: 'center', alignItems: 'center',
  },

  petScrollRow: { gap: 8, paddingBottom: 4 },
  petChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  petChipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  petChipText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  petChipTextActive: { color: Colors.white, fontFamily: Fonts.bold },
  petChipPhoto: { width: 24, height: 24, borderRadius: 12 },
  petChipPhotoFallback: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },

  errorBox: { backgroundColor: Colors.criticalBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  errorText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.critical, textAlign: 'center' },

  bottomActions: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  saveBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  publishBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.coral,
  },
  publishBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
});
