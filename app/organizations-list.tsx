import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Search, Filter, MapPin, Phone, Mail, Globe, Star, Building2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface Organization {
  id: string;
  name: string;
  description: string;
  type: 'shelter' | 'rescue' | 'clinic' | 'authority';
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  location: {
    address: {
      full: string;
      city: string;
      state: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  services: string[];
  animalCapacity: number;
  rating?: number;
  lastUpdated: string;
}

export default function OrganizationsListScreen() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const organizationTypes = [
    { id: 'all', name: 'All Organizations', icon: '🏢' },
    { id: 'shelter', name: 'Shelters', icon: '🏠' },
    { id: 'rescue', name: 'Rescue Groups', icon: '🚑' },
    { id: 'clinic', name: 'Veterinary Clinics', icon: '🏥' },
    { id: 'authority', name: 'Authorities', icon: '🏛️' },
  ];

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    filterOrganizations();
  }, [organizations, searchQuery, selectedType]);

  const loadOrganizations = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      params.append('limit', '50');

      const response = await fetch(`/api/external-organizations?${params}`);
      const result = await response.json();

      if (result.success) {
        setOrganizations(result.data || []);
      } else {
        Alert.alert('Error', 'Failed to load organizations');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to API');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterOrganizations = () => {
    let filtered = organizations;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(org => org.type === selectedType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(query) ||
        org.description.toLowerCase().includes(query) ||
        org.location.address.city.toLowerCase().includes(query) ||
        org.services.some(service => service.toLowerCase().includes(query))
      );
    }

    setFilteredOrganizations(filtered);
  };

  const handleRefresh = () => {
    loadOrganizations(true);
  };

  const getTypeIcon = (type: string) => {
    const typeData = organizationTypes.find(t => t.id === type);
    return typeData?.icon || '🏢';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'shelter': return Colors.primary;
      case 'rescue': return Colors.secondary;
      case 'clinic': return Colors.success;
      case 'authority': return Colors.accent;
      default: return Colors.textSecondary;
    }
  };

  const renderOrganizationItem = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      style={styles.organizationCard}
      onPress={() => router.push(`/organization-details?id=${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.organizationHeader}>
        <View style={styles.organizationIcon}>
          <Text style={styles.organizationTypeIcon}>{getTypeIcon(item.type)}</Text>
        </View>
        <View style={styles.organizationInfo}>
          <Text style={styles.organizationName}>{item.name}</Text>
          <Text style={styles.organizationType}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
        </View>
        {item.rating && (
          <View style={styles.ratingContainer}>
            <Star color={Colors.warning} size={16} fill={Colors.warning} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.organizationDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.organizationDetails}>
        <View style={styles.locationRow}>
          <MapPin color={Colors.textSecondary} size={14} />
          <Text style={styles.locationText}>
            {item.location.address.city}, {item.location.address.state}
          </Text>
        </View>
        
        <View style={styles.capacityRow}>
          <Building2 color={Colors.textSecondary} size={14} />
          <Text style={styles.capacityText}>
            Capacity: {item.animalCapacity} animals
          </Text>
        </View>
      </View>

      <View style={styles.servicesContainer}>
        <Text style={styles.servicesLabel}>Services:</Text>
        <View style={styles.servicesList}>
          {item.services.slice(0, 3).map((service, index) => (
            <View key={index} style={styles.serviceTag}>
              <Text style={styles.serviceTagText}>{service}</Text>
            </View>
          ))}
          {item.services.length > 3 && (
            <View style={styles.moreServicesTag}>
              <Text style={styles.moreServicesText}>+{item.services.length - 3}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.contactRow}>
        {item.contactInfo.phone && (
          <TouchableOpacity style={styles.contactButton}>
            <Phone color={Colors.primary} size={16} />
          </TouchableOpacity>
        )}
        {item.contactInfo.email && (
          <TouchableOpacity style={styles.contactButton}>
            <Mail color={Colors.primary} size={16} />
          </TouchableOpacity>
        )}
        {item.contactInfo.website && (
          <TouchableOpacity style={styles.contactButton}>
            <Globe color={Colors.primary} size={16} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const TypeFilter = ({ 
    type, 
    isSelected, 
    onPress 
  }: { 
    type: any; 
    isSelected: boolean; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.typeFilter,
        isSelected && styles.typeFilterActive
      ]}
      onPress={onPress}
    >
      <Text style={styles.typeFilterIcon}>{type.icon}</Text>
      <Text style={[
        styles.typeFilterText,
        isSelected && styles.typeFilterTextActive
      ]}>
        {type.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Organizations</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Organizations</Text>
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
            placeholder="Search organizations..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Type Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={organizationTypes}
          renderItem={({ item }) => (
            <TypeFilter
              type={item}
              isSelected={selectedType === item.id}
              onPress={() => setSelectedType(item.id)}
            />
          )}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFiltersContainer}
        />
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredOrganizations.length} organization{filteredOrganizations.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Organizations List */}
      <FlatList
        data={filteredOrganizations}
        renderItem={renderOrganizationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Building2 color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>No organizations found</Text>
            <Text style={styles.emptyDescription}>
              Check your API configuration or try adjusting your search filters
            </Text>
            <TouchableOpacity
              style={styles.configureButton}
              onPress={() => router.back()}
            >
              <Text style={styles.configureButtonText}>Configure API</Text>
            </TouchableOpacity>
          </View>
        }
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 16,
  },
  typeFiltersContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  typeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeFilterActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeFilterIcon: {
    fontSize: 16,
  },
  typeFilterText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  typeFilterTextActive: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  organizationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  organizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  organizationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  organizationTypeIcon: {
    fontSize: 24,
  },
  organizationInfo: {
    flex: 1,
  },
  organizationName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  organizationType: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.warning,
  },
  organizationDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  organizationDetails: {
    gap: 8,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  servicesContainer: {
    marginBottom: 12,
  },
  servicesLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  serviceTagText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  moreServicesTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  moreServicesText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.medium,
    color: Colors.white,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
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
  configureButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  configureButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
});