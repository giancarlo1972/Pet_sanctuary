import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Heart, Share2, Filter, Grid2x2 as Grid, List, MapPin, Phone, Star } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockPets } from '@/constants/mockData';

type ViewMode = 'grid' | 'list';
type FavoriteType = 'all' | 'pets' | 'clinics' | 'shelters' | 'rescuers';

interface FavoriteItem {
  id: string;
  type: 'pet' | 'clinic' | 'shelter' | 'rescuer' | 'admin';
  name: string;
  description: string;
  image: string;
  location: string;
  rating?: number;
  phone?: string;
  status?: string;
}

export default function FavoritesScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFilter, setSelectedFilter] = useState<FavoriteType>('all');

  // Mock favorites data with different types
  const [favorites] = useState<FavoriteItem[]>([
    {
      id: '1',
      type: 'pet',
      name: 'Luna',
      description: 'Golden Retriever looking for a home',
      image: 'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=400',
      location: 'Central Park, NY',
      status: 'available'
    },
    {
      id: '2',
      type: 'shelter',
      name: 'Happy Paws Shelter',
      description: 'Dedicated to finding homes for all pets',
      image: 'https://images.pexels.com/photos/4498362/pexels-photo-4498362.jpeg?auto=compress&cs=tinysrgb&w=400',
      location: 'Manhattan, NY',
      rating: 4.8,
      phone: '(555) 123-4567'
    },
    {
      id: '3',
      type: 'clinic',
      name: 'City Veterinary Clinic',
      description: 'Emergency and routine pet care',
      image: 'https://images.pexels.com/photos/6235233/pexels-photo-6235233.jpeg?auto=compress&cs=tinysrgb&w=400',
      location: 'Brooklyn, NY',
      rating: 4.6,
      phone: '(555) 987-6543'
    },
    {
      id: '4',
      type: 'rescuer',
      name: 'Sarah Johnson',
      description: 'Active pet rescuer and volunteer',
      image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
      location: 'Queens, NY',
      rating: 4.9
    },
    {
      id: '5',
      type: 'admin',
      name: 'Pet Control Services',
      description: 'Official animal control authority',
      image: 'https://images.pexels.com/photos/8434791/pexels-photo-8434791.jpeg?auto=compress&cs=tinysrgb&w=400',
      location: 'NYC Government',
      phone: '(311) 311-311'
    }
  ]);

  const filteredFavorites = favorites.filter(item => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pets') return item.type === 'pet';
    if (selectedFilter === 'clinics') return item.type === 'clinic';
    if (selectedFilter === 'shelters') return item.type === 'shelter';
    if (selectedFilter === 'rescuers') return item.type === 'rescuer' || item.type === 'admin';
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pet': return '🐾';
      case 'shelter': return '🏠';
      case 'clinic': return '🏥';
      case 'rescuer': return '👤';
      case 'admin': return '🏛️';
      default: return '❤️';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pet': return Colors.primary;
      case 'shelter': return Colors.secondary;
      case 'clinic': return Colors.success;
      case 'rescuer': return Colors.warning;
      case 'admin': return Colors.accent;
      default: return Colors.textSecondary;
    }
  };

  const shareFavorite = async (item: FavoriteItem) => {
    try {
      await Share.share({
        message: `Check out ${item.name} - ${item.description}`,
        url: item.image,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share.');
    }
  };

  const renderGridItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => {
        if (item.type === 'pet') {
          router.push(`/pet-details?id=${item.id}`);
        } else {
          // Handle other types - could open contact info, location, etc.
          Alert.alert(item.name, `Contact: ${item.phone || 'No phone available'}`);
        }
      }}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.gridImage} />
      <View style={styles.gridTypeIndicator}>
        <Text style={styles.gridTypeIcon}>{getTypeIcon(item.type)}</Text>
      </View>
      <TouchableOpacity
        style={styles.gridActionButton}
        onPress={() => shareFavorite(item)}
      >
        <Share2 color={Colors.white} size={16} />
      </TouchableOpacity>
      <View style={styles.gridInfo}>
        <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.gridDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.gridMeta}>
          <MapPin color={Colors.textSecondary} size={12} />
          <Text style={styles.gridLocation} numberOfLines={1}>{item.location}</Text>
        </View>
        {item.rating && (
          <View style={styles.gridRating}>
            <Star color={Colors.warning} size={12} fill={Colors.warning} />
            <Text style={styles.gridRatingText}>{item.rating}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        if (item.type === 'pet') {
          router.push(`/pet-details?id=${item.id}`);
        } else {
          Alert.alert(item.name, `Contact: ${item.phone || 'No phone available'}`);
        }
      }}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.listImage} />
      <View style={styles.listInfo}>
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <Text style={styles.listTypeIcon}>{getTypeIcon(item.type)}</Text>
            <Text style={styles.listName}>{item.name}</Text>
          </View>
          <View style={styles.listActions}>
            {item.phone && (
              <TouchableOpacity style={styles.listActionButton}>
                <Phone color={Colors.primary} size={16} />
              </TouchableOpacity>
            )}
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
          <View style={styles.listLocation}>
            <MapPin color={Colors.textSecondary} size={14} />
            <Text style={styles.listLocationText}>{item.location}</Text>
          </View>
          {item.rating && (
            <View style={styles.listRating}>
              <Star color={Colors.warning} size={14} fill={Colors.warning} />
              <Text style={styles.listRatingText}>{item.rating}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Favorites</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]}
            onPress={() => setViewMode('grid')}
          >
            <Grid color={viewMode === 'grid' ? Colors.white : Colors.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <List color={viewMode === 'list' ? Colors.white : Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

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
            isActive={selectedFilter === 'pets'}
            onPress={() => setSelectedFilter('pets')}
          />
          <FilterButton
            title="Clinics"
            isActive={selectedFilter === 'clinics'}
            onPress={() => setSelectedFilter('clinics')}
          />
          <FilterButton
            title="Shelters"
            isActive={selectedFilter === 'shelters'}
            onPress={() => setSelectedFilter('shelters')}
          />
          <FilterButton
            title="People"
            isActive={selectedFilter === 'rescuers'}
            onPress={() => setSelectedFilter('rescuers')}
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
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  gridRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  gridRatingText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.semibold,
    color: Colors.warning,
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
    justifyContent: 'space-between',
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
  listRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listRatingText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.warning,
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