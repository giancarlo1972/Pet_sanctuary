import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Heart, MapPin, PawPrint } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';

const CARD_GAP = 12;
const SIDE_PADDING = 20;

interface Pet {
  id: string;
  name: string;
  breed: string;
  species: string;
  age_text: string | null;
  main_photo_url: string | null;
  location: string | null;
  needs_foster: boolean;
}

interface FavoriteRow {
  id: string;
  target_id: string;
}

type FilterId = 'all' | 'dogs' | 'cats' | 'foster';

const FILTER_CHIPS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dogs', label: 'Dogs' },
  { id: 'cats', label: 'Cats' },
  { id: 'foster', label: 'Needs foster' },
];

export default function PetsScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const availableWidth = width - SIDE_PADDING * 2;
  const numColumns = 2;
  const cardWidth = (availableWidth - CARD_GAP) / numColumns;

  const loadPets = useCallback(async () => {
    setLoading(true);
    try {
      let local: Pet[] = [];
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, breed, species, age_text, main_photo_url, location, status, created_at')
        .eq('status', 'available')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (!error && data) {
        local = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          breed: p.breed || '',
          species: (p.species || '').toLowerCase(),
          age_text: p.age_text,
          main_photo_url: p.main_photo_url,
          location: p.location,
          needs_foster: false,
        }));
      }

      let remote: Pet[] = [];
      try {
        const resp = await fetch('/api/rescuegroups?pets=1&state=NY');
        if (resp.ok) {
          const json = await resp.json();
          remote = (json.pets || []) as Pet[];
        }
      } catch { /* ignore */ }

      const seen = new Set(local.map((p) => p.id));
      setPets([...local, ...remote.filter((p) => !seen.has(p.id))]);
    } catch {
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!user) { setFavorites(new Set()); return; }
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id, target_id')
        .eq('target_type', 'pet')
        .eq('user_id', user.id);
      if (data) setFavorites(new Set(data.map((f: FavoriteRow) => f.target_id)));
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { loadPets(); }, [loadPets]);
  useFocusEffect(useCallback(() => { loadFavorites(); }, [loadFavorites]));

  const toggleFavorite = async (petId: string) => {
    if (!user) { router.push('/auth'); return; }
    const isFav = favorites.has(petId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(petId); else next.add(petId);
      return next;
    });
    try {
      if (isFav) {
        await supabase.from('favorites').delete().eq('target_id', petId).eq('target_type', 'pet').eq('user_id', user.id);
      } else {
        await supabase.from('favorites').insert({ target_id: petId, target_type: 'pet', user_id: user.id });
      }
    } catch {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(petId); else next.delete(petId);
        return next;
      });
    }
  };

  const filteredPets = pets.filter((pet) => {
    const species = (pet.species || '').toLowerCase();
    if (activeFilter === 'dogs') return species === 'dog';
    if (activeFilter === 'cats') return species === 'cat';
    if (activeFilter === 'foster') return pet.needs_foster;
    return true;
  });

  const renderPetCard = ({ item }: { item: Pet }) => {
    const isFav = favorites.has(item.id);
    const photo = item.main_photo_url;
    return (
      <TouchableOpacity
        style={[styles.petCard, { width: cardWidth }]}
        onPress={() => router.push(`/pet-details?id=${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.petCardImageWrap}>
          {photo ? (
            photo.startsWith('http') ? (
          <Image source={{ uri: photo }} style={styles.petCardImage} resizeMode="contain" />
            ) : (
              <SignedImage path={photo} style={styles.petCardImage} />
            )
          ) : (
            <View style={[styles.petCardImage, { justifyContent: 'center', alignItems: 'center' }]}>
              <PawPrint color={Colors.textTertiary} size={28} />
            </View>
          )}
          <TouchableOpacity style={styles.heartButton} onPress={() => toggleFavorite(item.id)} activeOpacity={0.7}>
            <Heart color={isFav ? Colors.coral : Colors.white} fill={isFav ? Colors.coral : 'transparent'} size={18} />
          </TouchableOpacity>
          {item.needs_foster && (
            <View style={styles.fosterPill}>
              <Text style={styles.fosterPillText}>NEEDS FOSTER</Text>
            </View>
          )}
        </View>
        <View style={styles.petCardInfo}>
          <Text style={styles.petCardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.petCardBreed} numberOfLines={1}>{item.breed}</Text>
          <View style={styles.petCardMeta}>
            {item.location ? (
              <View style={styles.metaItem}>
                <MapPin color={Colors.textSecondary} size={11} />
                <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
              </View>
            ) : null}
            {item.age_text ? (
              <Text style={styles.ageText}>{item.age_text}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <AppHeader title="Pets" />
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarContent}>
          {FILTER_CHIPS.map((chip) => {
            const active = activeFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(chip.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.galleryHeader}>
        <Text style={styles.galleryLabel}>All pets</Text>
        <Text style={styles.galleryCount}>
          {filteredPets.length} pet{filteredPets.length !== 1 ? 's' : ''}
        </Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      ) : (
        <FlatList
          data={filteredPets}
          renderItem={renderPetCard}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`grid-${numColumns}`}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <PawPrint color={Colors.textTertiary} size={48} />
              <Text style={styles.emptyTitle}>No pets available</Text>
              <Text style={styles.emptyDescription}>Try adjusting your filters or check back soon</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  filterBar: { paddingBottom: 8 },
  filterBarContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E8EAF0',
  },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterChipText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy,
  },
  filterChipTextActive: { color: Colors.white },
  galleryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  galleryLabel: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text,
  },
  galleryCount: {
    fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  petCard: {
    backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  petCardImageWrap: {
    position: 'relative', width: '100%', height: 200,
    backgroundColor: Colors.navy, overflow: 'hidden',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  petCardImage: { width: '100%', height: '100%' },
  heartButton: {
    position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  fosterPill: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: Colors.teal, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  fosterPillText: {
    fontSize: 9, fontFamily: Fonts.bold, color: Colors.white, letterSpacing: 0.5,
  },
  petCardInfo: { padding: 12, gap: 2 },
  petCardName: {
    fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text,
  },
  petCardBreed: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
  },
  petCardMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, flexShrink: 1,
  },
  ageText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.coral,
  },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingTop: 80, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginTop: 16,
  },
  emptyDescription: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 8,
  },
});
