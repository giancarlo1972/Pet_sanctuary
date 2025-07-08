import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Search, Filter, Grid2x2 as Grid, List, Calendar, MapPin, Share2, CreditCard as Edit3, X, Play, Download } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

const { width, height } = Dimensions.get('window');

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  uri: string;
  thumbnail?: string;
  title: string;
  description: string;
  location: string;
  date: string;
  tags: string[];
  petId?: string;
  petName?: string;
}

export default function MediaGalleryScreen() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'photos' | 'videos'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'location' | 'pet'>('date');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Mock media data
  const [mediaItems] = useState<MediaItem[]>([
    {
      id: '1',
      type: 'photo',
      uri: 'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=800',
      title: 'Luna at the Park',
      description: 'Beautiful golden retriever enjoying a sunny day at Central Park',
      location: 'Central Park, NY',
      date: '2024-01-28T14:30:00Z',
      tags: ['golden-retriever', 'park', 'sunny'],
      petId: '1',
      petName: 'Luna',
    },
    {
      id: '2',
      type: 'video',
      uri: 'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=800',
      thumbnail: 'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=400',
      title: 'Max Playing',
      description: 'Playful cat chasing a toy mouse',
      location: 'Home',
      date: '2024-01-27T16:45:00Z',
      tags: ['cat', 'playing', 'indoor'],
      petId: '2',
      petName: 'Max',
    },
    {
      id: '3',
      type: 'photo',
      uri: 'https://images.pexels.com/photos/1490908/pexels-photo-1490908.jpeg?auto=compress&cs=tinysrgb&w=800',
      title: 'Bella Training',
      description: 'Border collie practicing agility training',
      location: 'Dog Training Center',
      date: '2024-01-26T10:15:00Z',
      tags: ['border-collie', 'training', 'agility'],
      petId: '3',
      petName: 'Bella',
    },
    {
      id: '4',
      type: 'photo',
      uri: 'https://images.pexels.com/photos/1741205/pexels-photo-1741205.jpeg?auto=compress&cs=tinysrgb&w=800',
      title: 'Rescue Cat',
      description: 'Newly rescued cat at the shelter',
      location: 'Happy Paws Shelter',
      date: '2024-01-25T09:30:00Z',
      tags: ['rescue', 'shelter', 'cat'],
    },
    {
      id: '5',
      type: 'video',
      uri: 'https://images.pexels.com/photos/1888559/pexels-photo-1888559.jpeg?auto=compress&cs=tinysrgb&w=800',
      thumbnail: 'https://images.pexels.com/photos/1888559/pexels-photo-1888559.jpeg?auto=compress&cs=tinysrgb&w=400',
      title: 'Adoption Day',
      description: 'Happy family adopting their new pet',
      location: 'Pet Sanctuary',
      date: '2024-01-24T13:20:00Z',
      tags: ['adoption', 'family', 'happy'],
    },
  ]);

  const filteredAndSortedMedia = mediaItems
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = selectedFilter === 'all' || 
                           (selectedFilter === 'photos' && item.type === 'photo') ||
                           (selectedFilter === 'videos' && item.type === 'video');
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'location':
          return a.location.localeCompare(b.location);
        case 'pet':
          return (a.petName || '').localeCompare(b.petName || '');
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const shareMedia = async (item: MediaItem) => {
    try {
      await Share.share({
        message: `${item.title} - ${item.description}`,
        url: item.uri,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share media.');
    }
  };

  const saveDescription = () => {
    if (selectedMedia) {
      // Update description in your data store
      Alert.alert('Success', 'Description updated successfully!');
      setEditingDescription(false);
    }
  };

  const renderGridItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => setSelectedMedia(item)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.type === 'video' ? item.thumbnail || item.uri : item.uri }} 
        style={styles.gridImage} 
      />
      {item.type === 'video' && (
        <View style={styles.playIcon}>
          <Play color={Colors.white} size={20} fill={Colors.white} />
        </View>
      )}
      <View style={styles.gridOverlay}>
        <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.gridDate}>{formatDate(item.date)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => setSelectedMedia(item)}
      activeOpacity={0.8}
    >
      <View style={styles.listImageContainer}>
        <Image 
          source={{ uri: item.type === 'video' ? item.thumbnail || item.uri : item.uri }} 
          style={styles.listImage} 
        />
        {item.type === 'video' && (
          <View style={styles.listPlayIcon}>
            <Play color={Colors.white} size={16} fill={Colors.white} />
          </View>
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listTitle}>{item.title}</Text>
        <Text style={styles.listDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.listMeta}>
          <View style={styles.listMetaItem}>
            <Calendar color={Colors.textSecondary} size={12} />
            <Text style={styles.listMetaText}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.listMetaItem}>
            <MapPin color={Colors.textSecondary} size={12} />
            <Text style={styles.listMetaText}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.tagContainer}>
          {item.tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={() => shareMedia(item)}
      >
        <Share2 color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
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
        <Text style={styles.title}>Media Gallery</Text>
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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search photos and videos..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <FilterButton
            title="All"
            isActive={selectedFilter === 'all'}
            onPress={() => setSelectedFilter('all')}
          />
          <FilterButton
            title="Photos"
            isActive={selectedFilter === 'photos'}
            onPress={() => setSelectedFilter('photos')}
          />
          <FilterButton
            title="Videos"
            isActive={selectedFilter === 'videos'}
            onPress={() => setSelectedFilter('videos')}
          />
        </View>

        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const options = ['date', 'location', 'pet'];
              const currentIndex = options.indexOf(sortBy);
              const nextIndex = (currentIndex + 1) % options.length;
              setSortBy(options[nextIndex] as any);
            }}
          >
            <Text style={styles.sortText}>
              {sortBy === 'date' ? 'Date' : sortBy === 'location' ? 'Location' : 'Pet'}
            </Text>
            <Filter color={Colors.primary} size={16} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredAndSortedMedia.length} item{filteredAndSortedMedia.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Media Grid/List */}
      <FlatList
        data={filteredAndSortedMedia}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Media Detail Modal */}
      <Modal
        visible={selectedMedia !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedMedia && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedMedia(null)}
              >
                <X color={Colors.text} size={24} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedMedia.title}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => shareMedia(selectedMedia)}
                >
                  <Share2 color={Colors.primary} size={20} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalActionButton}>
                  <Download color={Colors.primary} size={20} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.modalImageContainer}>
                <Image source={{ uri: selectedMedia.uri }} style={styles.modalImage} />
                {selectedMedia.type === 'video' && (
                  <TouchableOpacity style={styles.modalPlayButton}>
                    <Play color={Colors.white} size={32} fill={Colors.white} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.modalInfo}>
                <View style={styles.modalMetaRow}>
                  <View style={styles.modalMetaItem}>
                    <Calendar color={Colors.textSecondary} size={16} />
                    <Text style={styles.modalMetaText}>{formatDate(selectedMedia.date)}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <MapPin color={Colors.textSecondary} size={16} />
                    <Text style={styles.modalMetaText}>{selectedMedia.location}</Text>
                  </View>
                </View>

                {selectedMedia.petName && (
                  <Text style={styles.modalPetName}>Pet: {selectedMedia.petName}</Text>
                )}

                <View style={styles.modalDescriptionContainer}>
                  <View style={styles.modalDescriptionHeader}>
                    <Text style={styles.modalDescriptionLabel}>Description</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setEditingDescription(true);
                        setNewDescription(selectedMedia.description);
                      }}
                    >
                      <Edit3 color={Colors.primary} size={16} />
                    </TouchableOpacity>
                  </View>
                  
                  {editingDescription ? (
                    <View style={styles.editDescriptionContainer}>
                      <TextInput
                        style={styles.editDescriptionInput}
                        value={newDescription}
                        onChangeText={setNewDescription}
                        multiline
                        placeholder="Add a description..."
                        placeholderTextColor={Colors.textSecondary}
                      />
                      <View style={styles.editDescriptionActions}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => setEditingDescription(false)}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={saveDescription}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.modalDescription}>{selectedMedia.description}</Text>
                  )}
                </View>

                <View style={styles.modalTagContainer}>
                  {selectedMedia.tags.map((tag, index) => (
                    <View key={index} style={styles.modalTag}>
                      <Text style={styles.modalTagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </SafeAreaView>
        )}
      </Modal>
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  filtersContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  sortText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
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
    margin: 6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gridImage: {
    width: '100%',
    height: 140,
  },
  playIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
  },
  gridTitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  gridDate: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 2,
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
  listImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  listPlayIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  listDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  listMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  listMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listMetaText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  tagText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalImageContainer: {
    position: 'relative',
    height: height * 0.4,
    backgroundColor: Colors.black,
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  modalPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfo: {
    flex: 1,
    padding: 20,
  },
  modalMetaRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  modalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalMetaText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  modalPetName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
    marginBottom: 16,
  },
  modalDescriptionContainer: {
    marginBottom: 20,
  },
  modalDescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalDescriptionLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 22,
  },
  editDescriptionContainer: {
    gap: 12,
  },
  editDescriptionInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editDescriptionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  modalTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  modalTagText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
});