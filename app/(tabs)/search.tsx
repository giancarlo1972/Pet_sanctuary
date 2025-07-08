import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockPets } from '@/constants/mockData';
import { router } from 'expo-router';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');

  const categories = [
    { id: 'all', name: 'All', icon: '🐾' },
    { id: 'dog', name: 'Dogs', icon: '🐕' },
    { id: 'cat', name: 'Cats', icon: '🐱' },
    { id: 'other', name: 'Others', icon: '🐰' },
  ];

  const sizes = [
    { id: 'all', name: 'All Sizes' },
    { id: 'small', name: 'Small' },
    { id: 'medium', name: 'Medium' },
    { id: 'large', name: 'Large' },
  ];

  const filteredPets = mockPets.filter(pet => {
    const matchesSearch = pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pet.breed.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || pet.species === selectedCategory;
    const matchesSize = selectedSize === 'all' || pet.size === selectedSize;
    
    return matchesSearch && matchesCategory && matchesSize;
  });

  const renderPetItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.petItem}
      onPress={() => router.push(`/pet-details?id=${item.id}`)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.photos[0] }} style={styles.petItemImage} />
      <View style={styles.petItemInfo}>
        <Text style={styles.petItemName}>{item.name}</Text>
        <Text style={styles.petItemBreed}>{item.breed}</Text>
        <View style={styles.petItemMetadata}>
          <View style={styles.locationContainer}>
            <MapPin color={Colors.textSecondary} size={12} />
            <Text style={styles.locationText}>{item.location.address}</Text>
          </View>
          <Text style={styles.ageText}>{item.age} years old</Text>
        </View>
        <View style={styles.tagsContainer}>
          {item.personality.slice(0, 2).map((trait: string, index: number) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{trait}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Your Pet</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Filter color={Colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pets by name or breed..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Size Filter */}
      <View style={styles.section}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {sizes.map(size => (
            <TouchableOpacity
              key={size.id}
              style={[
                styles.filterButton,
                selectedSize === size.id && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedSize(size.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedSize === size.id && styles.filterTextActive,
                ]}
              >
                {size.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {filteredPets.length} pets found
        </Text>
      </View>

      <FlatList
        data={filteredPets}
        renderItem={renderPetItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
  section: {
    marginBottom: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    gap: 8,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
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
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  petItem: {
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
  petItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  petItemInfo: {
    flex: 1,
    gap: 4,
  },
  petItemName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  petItemBreed: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  petItemMetadata: {
    marginTop: 4,
    gap: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  ageText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  tagText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
});