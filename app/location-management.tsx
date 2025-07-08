import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowLeft, Search, MapPin, Star, Clock, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import MapComponent from '@/components/MapComponent';

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isFavorite: boolean;
  lastUsed: string;
}

export default function LocationManagementScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([
    {
      id: '1',
      name: 'Home',
      address: '123 Main St, New York, NY',
      latitude: 40.7128,
      longitude: -74.0060,
      isFavorite: true,
      lastUsed: '2024-01-28T10:00:00Z',
    },
    {
      id: '2',
      name: 'Central Park',
      address: 'Central Park, New York, NY',
      latitude: 40.7829,
      longitude: -73.9654,
      isFavorite: true,
      lastUsed: '2024-01-27T15:30:00Z',
    },
    {
      id: '3',
      name: 'Brooklyn Bridge',
      address: 'Brooklyn Bridge, New York, NY',
      latitude: 40.7061,
      longitude: -73.9969,
      isFavorite: false,
      lastUsed: '2024-01-26T12:15:00Z',
    },
  ]);
  const [selectedLocation, setSelectedLocation] = useState<SavedLocation | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const result = results[0];
        const newRegion = {
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setRegion(newRegion);
        
        // Add to search history
        const newLocation: SavedLocation = {
          id: Date.now().toString(),
          name: searchQuery,
          address: searchQuery,
          latitude: result.latitude,
          longitude: result.longitude,
          isFavorite: false,
          lastUsed: new Date().toISOString(),
        };
        setSavedLocations(prev => [newLocation, ...prev]);
      } else {
        Alert.alert('Not Found', 'Location not found. Please try a different search term.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search location.');
    }
  };

  const toggleFavorite = (locationId: string) => {
    setSavedLocations(prev =>
      prev.map(loc =>
        loc.id === locationId ? { ...loc, isFavorite: !loc.isFavorite } : loc
      )
    );
  };

  const selectLocation = (location: SavedLocation) => {
    setSelectedLocation(location);
    setRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
    
    // Update last used
    setSavedLocations(prev =>
      prev.map(loc =>
        loc.id === location.id ? { ...loc, lastUsed: new Date().toISOString() } : loc
      )
    );
  };

  const formatLastUsed = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };

  const renderLocationItem = ({ item }: { item: SavedLocation }) => (
    <TouchableOpacity
      style={[
        styles.locationItem,
        selectedLocation?.id === item.id && styles.locationItemSelected
      ]}
      onPress={() => selectLocation(item)}
    >
      <View style={styles.locationIcon}>
        <MapPin color={Colors.primary} size={20} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress}>{item.address}</Text>
        <View style={styles.locationMeta}>
          <Clock color={Colors.textSecondary} size={12} />
          <Text style={styles.locationTime}>{formatLastUsed(item.lastUsed)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(item.id)}
      >
        <Star
          color={item.isFavorite ? Colors.warning : Colors.textSecondary}
          size={20}
          fill={item.isFavorite ? Colors.warning : 'none'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const favoriteLocations = savedLocations.filter(loc => loc.isFavorite);
  const recentLocations = savedLocations
    .filter(loc => !loc.isFavorite)
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Location Management</Text>
        <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
          <Navigation color={Colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for an address or place..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchLocation}
          />
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapComponent
          region={region}
          onRegionChangeComplete={setRegion}
          currentLocation={currentLocation}
          savedLocations={savedLocations}
        />
      </View>

      {/* Locations List */}
      <View style={styles.locationsContainer}>
        {favoriteLocations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorite Locations</Text>
            <FlatList
              data={favoriteLocations}
              renderItem={renderLocationItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {recentLocations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Locations</Text>
            <FlatList
              data={recentLocations}
              renderItem={renderLocationItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
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
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  currentLocationButton: {
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
  mapContainer: {
    height: 250,
    backgroundColor: Colors.surface,
  },
  locationsContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  locationItemSelected: {
    backgroundColor: Colors.surface,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  locationAddress: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationTime: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});