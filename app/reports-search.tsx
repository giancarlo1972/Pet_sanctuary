import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Search, Filter, MapPin, Calendar, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface ExistingReport {
  id: string;
  type: 'lost' | 'found' | 'incident' | 'emergency';
  title: string;
  description: string;
  animalType: 'dog' | 'cat' | 'other';
  characteristics: {
    size: 'small' | 'medium' | 'large';
    color: string;
    breed?: string;
    age?: string;
  };
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  reportedDate: string;
  status: 'active' | 'resolved' | 'investigating';
  photos: string[];
  matchScore?: number;
}

export default function ReportsSearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    animalType: 'all',
    size: 'all',
    status: 'all',
    reportType: 'all',
  });
  const [searchResults, setSearchResults] = useState<ExistingReport[]>([]);
  const [searching, setSearching] = useState(false);

  // Mock database of existing reports
  const mockReports: ExistingReport[] = [
    {
      id: '1',
      type: 'lost',
      title: 'Lost Golden Retriever - Luna',
      description: 'Friendly golden retriever missing from Central Park area. Responds to name Luna.',
      animalType: 'dog',
      characteristics: {
        size: 'large',
        color: 'Golden',
        breed: 'Golden Retriever',
        age: '3 years'
      },
      location: {
        address: 'Central Park, Manhattan, NY',
        coordinates: { latitude: 40.7829, longitude: -73.9654 }
      },
      reportedDate: '2024-01-28T10:00:00Z',
      status: 'active',
      photos: ['https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=400'],
      matchScore: 95
    },
    {
      id: '2',
      type: 'found',
      title: 'Found Gray Tabby Cat',
      description: 'Small gray tabby cat found near Brooklyn Bridge. Very friendly, appears well-cared for.',
      animalType: 'cat',
      characteristics: {
        size: 'small',
        color: 'Gray and White',
        breed: 'Domestic Shorthair'
      },
      location: {
        address: 'Brooklyn Bridge Park, Brooklyn, NY',
        coordinates: { latitude: 40.7061, longitude: -73.9969 }
      },
      reportedDate: '2024-01-27T15:30:00Z',
      status: 'active',
      photos: ['https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=400'],
      matchScore: 87
    },
    {
      id: '3',
      type: 'incident',
      title: 'Injured Dog Report',
      description: 'Medium-sized dog with apparent leg injury spotted near highway. Needs immediate assistance.',
      animalType: 'dog',
      characteristics: {
        size: 'medium',
        color: 'Black and Brown',
        breed: 'Mixed breed'
      },
      location: {
        address: 'FDR Drive, Lower East Side, NY',
        coordinates: { latitude: 40.7128, longitude: -73.9772 }
      },
      reportedDate: '2024-01-26T12:15:00Z',
      status: 'investigating',
      photos: [],
      matchScore: 73
    }
  ];

  const performSearch = async () => {
    setSearching(true);
    
    // Simulate API search with smart matching
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let results = mockReports.filter(report => {
      const matchesQuery = !searchQuery || 
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.characteristics.color.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.characteristics.breed?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedFilters.animalType === 'all' || report.animalType === selectedFilters.animalType;
      const matchesSize = selectedFilters.size === 'all' || report.characteristics.size === selectedFilters.size;
      const matchesStatus = selectedFilters.status === 'all' || report.status === selectedFilters.status;
      const matchesReportType = selectedFilters.reportType === 'all' || report.type === selectedFilters.reportType;
      
      return matchesQuery && matchesType && matchesSize && matchesStatus && matchesReportType;
    });
    
    // Sort by match score (in real app, this would be calculated based on multiple factors)
    results = results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    
    setSearchResults(results);
    setSearching(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return Colors.error;
      case 'resolved': return Colors.success;
      case 'investigating': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle color={Colors.error} size={16} />;
      case 'resolved': return <CheckCircle color={Colors.success} size={16} />;
      case 'investigating': return <Search color={Colors.warning} size={16} />;
      default: return null;
    }
  };

  const renderReportItem = ({ item }: { item: ExistingReport }) => (
    <TouchableOpacity
      style={styles.reportItem}
      onPress={() => router.push(`/reports-details?id=${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportHeaderLeft}>
          <Text style={styles.reportTitle}>{item.title}</Text>
          <View style={styles.statusContainer}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        {item.matchScore && (
          <View style={styles.matchScore}>
            <Text style={styles.matchScoreText}>{item.matchScore}%</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.reportDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.reportDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>{item.animalType}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Size:</Text>
          <Text style={styles.detailValue}>{item.characteristics.size}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Color:</Text>
          <Text style={styles.detailValue}>{item.characteristics.color}</Text>
        </View>
      </View>
      
      <View style={styles.reportFooter}>
        <View style={styles.locationContainer}>
          <MapPin color={Colors.textSecondary} size={14} />
          <Text style={styles.locationText}>{item.location.address}</Text>
        </View>
        <View style={styles.dateContainer}>
          <Calendar color={Colors.textSecondary} size={14} />
          <Text style={styles.dateText}>{formatDate(item.reportedDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const FilterChip = ({ 
    label, 
    value, 
    selectedValue, 
    onPress 
  }: { 
    label: string; 
    value: string; 
    selectedValue: string; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        selectedValue === value && styles.filterChipActive
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.filterChipText,
        selectedValue === value && styles.filterChipTextActive
      ]}>
        {label}
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
        <Text style={styles.title}>Search Reports Database</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by characteristics, location, or description..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={performSearch}
          />
        </View>
        <TouchableOpacity 
          style={[styles.searchButton, searching && styles.searchButtonDisabled]} 
          onPress={performSearch}
          disabled={searching}
        >
          <Text style={styles.searchButtonText}>
            {searching ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Animal Type:</Text>
          <View style={styles.filterChips}>
            <FilterChip label="All" value="all" selectedValue={selectedFilters.animalType} onPress={() => setSelectedFilters(prev => ({ ...prev, animalType: 'all' }))} />
            <FilterChip label="Dogs" value="dog" selectedValue={selectedFilters.animalType} onPress={() => setSelectedFilters(prev => ({ ...prev, animalType: 'dog' }))} />
            <FilterChip label="Cats" value="cat" selectedValue={selectedFilters.animalType} onPress={() => setSelectedFilters(prev => ({ ...prev, animalType: 'cat' }))} />
            <FilterChip label="Other" value="other" selectedValue={selectedFilters.animalType} onPress={() => setSelectedFilters(prev => ({ ...prev, animalType: 'other' }))} />
          </View>
        </View>
        
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Status:</Text>
          <View style={styles.filterChips}>
            <FilterChip label="All" value="all" selectedValue={selectedFilters.status} onPress={() => setSelectedFilters(prev => ({ ...prev, status: 'all' }))} />
            <FilterChip label="Active" value="active" selectedValue={selectedFilters.status} onPress={() => setSelectedFilters(prev => ({ ...prev, status: 'active' }))} />
            <FilterChip label="Resolved" value="resolved" selectedValue={selectedFilters.status} onPress={() => setSelectedFilters(prev => ({ ...prev, status: 'resolved' }))} />
          </View>
        </View>
      </ScrollView>

      {/* Results */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {searchResults.length} matching reports found
        </Text>
        
        <FlatList
          data={searchResults}
          renderItem={renderReportItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsList}
        />
      </View>
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
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
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
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  filtersContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterSectionTitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resultsText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  resultsList: {
    paddingBottom: 20,
  },
  reportItem: {
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
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportHeaderLeft: {
    flex: 1,
  },
  reportTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bold,
  },
  matchScore: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchScoreText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  reportDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
});