import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Heart, Share2, Filter, Grid2x2 as Grid, List, MapPin, Phone, Star } from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';

type ViewMode = 'grid' | 'list';
type FavoriteType = 'all' | 'pet' | 'shelter' | 'clinic' | 'person';

interface FavoriteItem {
  id: string;
  target_type: 'pet' | 'shelter' | 'clinic' | 'person';
  target_id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  rating?: number;
  phone?: string;
  status?: string;
}

export default function FavoritesScreen() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFilter, setSelectedFilter] = useState<FavoriteType>('all');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setFavorites([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: favRows, error: favError } = await supabase
        .from('favorites')
        .select('id, target_type, target_id')
        .eq('user_id', user.id);

      if (favError) throw favError;
      if (!favRows || favRows.length === 0) {
        setFavorites([]);
        return;
      }

      const items: FavoriteItem[] = [];

      // Group target_ids by type for batch queries
      const byType: Record<string, string[]> = { pet: [], shelter: [], clinic: [], person: [] };
      for (const row of favRows) {
        if (row.target_type && row.target_id && byType[row.target_type]) {
          byType[row.target_type].push(row.target_id);
        }
      }

      // Fetch pets
      if (byType.pet.length > 0) {
        const { data: pets } = await supabase
          .from('pets')
          .select('id, name, breed, species, age_text, status, main_photo_url, location')
          .in('id', byType.pet);
        if (pets) {
          for (const p of pets) {
            items.push({
              id: favRows.find(r => r.target_id === p.id)!.id,
              target_type: 'pet',
              target_id: p.id,
              name: p.name,
              description: `${p.breed || ''} · ${p.age_text || ''}`.trim(),
              image: p.main_photo_url || '',
              location: p.location || '',
              status: p.status,
            });
          }
        }
      }

      // Fetch shelters
      if (byType.shelter.length > 0) {
        const { data: shelters } = await supabase
          .from('shelters')
          .select('id, name, city, state, phone, email, logo_url')
          .in('id', byType.shelter);
        if (shelters) {
          for (const s of shelters) {
            items.push({
              id: favRows.find(r => r.target_id === s.id)!.id,
              target_type: 'shelter',
              target_id: s.id,
              name: s.name,
              description: 'Animal shelter and rescue',
              image: s.logo_url || '',
              location: [s.city, s.state].filter(Boolean).join(', '),
              phone: s.phone || undefined,
            });
          }
        }
      }

      // Fetch clinics (stored in shelters table with a differentiator — for now shelters serve both)
      // If you add a clinics table later, query it here.
      if (byType.clinic.length > 0) {
        const { data: clinics } = await supabase
          .from('shelters')
          .select('id, name, city, state, phone, email, logo_url')
          .in('id', byType.clinic);
        if (clinics) {
          for (const c of clinics) {
            items.push({
              id: favRows.find(r => r.target_id === c.id)!.id,
              target_type: 'clinic',
              target_id: c.id,
              name: c.name,
              description: 'Veterinary clinic',
              image: c.logo_url || '',
              location: [c.city, c.state].filter(Boolean).join(', '),
              phone: c.phone || undefined,
            });
          }
        }
      }

      // Fetch people (profiles)
      if (byType.person.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, location')
          .in('id', byType.person);
        if (profiles) {
          for (const p of profiles) {
            items.push({
              id: favRows.find(r => r.target_id === p.id)!.id,
              target_type: 'person',
              target_id: p.id,
              name: p.full_name || 'Unknown',
              description: 'Rescuer and volunteer',
              image: p.avatar_url || '',
              location: p.location || '',
            });
          }
        }
      }

      setFavorites(items);
    } catch (err: any) {
      console.error('Failed to load favorites:', err);
      setError('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleRemoveFavorite = async (item: FavoriteItem) => {
    if (!user) return;

    setFavorites(prev => prev.filter(f => f.id !== item.id));

    const { error: delError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', item.id);

    if (delError) {
      console.error('[favorites] remove failed:', delError);
      setBanner({ message: 'Failed to remove favorite', kind: 'error' });
      loadFavorites();
    }
  };

  const filteredFavorites = favorites.filter(item => {
    if (selectedFilter === 'all') return true;
    return item.target_type === selectedFilter;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pet': return '🐾';
      case 'shelter': return '🏠';
      case 'clinic': return '🏥';
      case 'person': return '👤';
      default: return '❤️';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pet': return Colors.primary;
      case 'shelter': return Colors.secondary;
      case 'clinic': return Colors.success;
      case 'person': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  const handleItemPress = (item: FavoriteItem) => {
    if (item.target_type === 'pet') {
      router.push(`/pet-details?id=${item.target_id}`);
    } else if (item.target_type === 'shelter' || item.target_type === 'clinic') {
      router.push(`/organization-details?id=${item.target_id}`);
    }
  };

  const shareFavorite = async (item: FavoriteItem) => {
    try {
      await Share.share({
        message: `Check out ${item.name} - ${item.description}`,
      });
    } catch (err) {
      console.error('[favorites] share failed:', err);
      setBanner({ message: 'Failed to share.', kind: 'error' });
    }
  };

  const renderGridItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.8}
    >
      {item.image ? (
        <SignedImage path={item.image} style={styles.gridImage} />
      ) : (
        <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
          <Heart color={Colors.textSecondary} size={32} />
        </View>
      )}
      <View style={styles.gridTypeIndicator}>
        <Text style={styles.gridTypeIcon}>{getTypeIcon(item.target_type)}</Text>
      </View>
      <TouchableOpacity
        style={styles.gridActionButton}
        onPress={() => shareFavorite(item)}
      >
        <Share2 color={Colors.white} size={16} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.gridHeartButton}
        onPress={() => handleRemoveFavorite(item)}
      >
        <Heart color={Colors.error} size={16} fill={Colors.error} />
      </TouchableOpacity>
      <View style={styles.gridInfo}>
        <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.gridDescription} numberOfLines={2}>{item.description}</Text>
        {item.location ? (
          <View style={styles.gridMeta}>
            <MapPin color={Colors.textSecondary} size={12} />
            <Text style={styles.gridLocation} numberOfLines={1}>{item.location}</Text>
          </View>
        ) : null}
        {item.phone && (
          <View style={styles.gridMeta}>
            <Phone color={Colors.textSecondary} size={12} />
            <Text style={styles.gridLocation} numberOfLines={1}>{item.phone}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.8}
    >
      {item.image ? (
        <SignedImage path={item.image} style={styles.listImage} />
      ) : (
        <View style={[styles.listImage, styles.listImagePlaceholder]}>
          <Heart color={Colors.textSecondary} size={28} />
        </View>
      )}
      <View style={styles.listInfo}>
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <Text style={styles.listTypeIcon}>{getTypeIcon(item.target_type)}</Text>
            <Text style={styles.listName}>{item.name}</Text>
          </View>
          <View style={styles.listActions}>
            <TouchableOpacity
              style={styles.listActionButton}
              onPress={() => handleRemoveFavorite(item)}
            >
              <Heart color={Colors.error} size={16} fill={Colors.error} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.listActionButton}
              onPress={() => shareFavorite(item)}
            >
              <Share2 color={Colors.textSecondary} size={16} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.listDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.listMeta}>
          {item.location ? (
            <View style={styles.listLocation}>
              <MapPin color={Colors.textSecondary} size={14} />
              <Text style={styles.listLocationText}>{item.location}</Text>
            </View>
          ) : null}
          {item.phone && (
            <View style={styles.listLocation}>
              <Phone color={Colors.textSecondary} size={14} />
              <Text style={styles.listLocationText}>{item.phone}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({
    title,
    isActive,
    onPress
  }: {
    title: string;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Heart color={Colors.textSecondary} size={64} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyDescription}>{error}</Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={loadFavorites}
          >
            <Text style={styles.exploreButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Heart color={Colors.textSecondary} size={64} />
        <Text style={styles.emptyTitle}>No favorites yet</Text>
        <Text style={styles.emptyDescription}>
          Start exploring and tap the heart icon to save pets, clinics, shelters, and rescuers!
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.exploreButtonText}>Explore Now</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader title="Favorites" showBack rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]} onPress={() => setViewMode('grid')}>
            <Grid color={viewMode === 'grid' ? Colors.white : Colors.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]} onPress={() => setViewMode('list')}>
            <List color={viewMode === 'list' ? Colors.white : Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      } />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Show:</Text>
        <View style={styles.filterRow}>
          <FilterButton
            title="All"
            isActive={selectedFilter === 'all'}
            onPress={() => setSelectedFilter('all')}
          />
          <FilterButton
            title="Pets"
            isActive={selectedFilter === 'pet'}
            onPress={() => setSelectedFilter('pet')}
          />
          <FilterButton
            title="Clinics"
            isActive={selectedFilter === 'clinic'}
            onPress={() => setSelectedFilter('clinic')}
          />
          <FilterButton
            title="Shelters"
            isActive={selectedFilter === 'shelter'}
            onPress={() => setSelectedFilter('shelter')}
          />
          <FilterButton
            title="People"
            isActive={selectedFilter === 'person'}
            onPress={() => setSelectedFilter('person')}
          />
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredFavorites.length} favorite{filteredFavorites.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Favorites List */}
      {filteredFavorites.length > 0 ? (
        <FlatList
          data={filteredFavorites}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonActive: {
    backgroundColor: Colors.primary,
  },
  filtersContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  filterLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  filterTextActive: {
    color: Colors.white,
  },
  resultsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // Grid styles
  gridItem: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    margin: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gridImage: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.surface,
  },
  gridImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTypeIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTypeIcon: {
    fontSize: 16,
  },
  gridActionButton: {
    position: 'absolute',
    top: 8,
    right: 44,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridHeartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridInfo: {
    padding: 12,
  },
  gridName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  gridDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  gridLocation: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    flex: 1,
  },
  // List styles
  listItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: Colors.surface,
  },
  listImagePlaceholder: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  listTypeIcon: {
    fontSize: 16,
  },
  listName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    flex: 1,
  },
  listActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  listMeta: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  listLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  listLocationText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  exploreButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  exploreButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
});
