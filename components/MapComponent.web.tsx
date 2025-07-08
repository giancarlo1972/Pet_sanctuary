import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import * as Location from 'expo-location';

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isFavorite: boolean;
  lastUsed: string;
}

interface MapComponentProps {
  region: any;
  onRegionChangeComplete: (region: any) => void;
  currentLocation: Location.LocationObject | null;
  savedLocations: SavedLocation[];
}

export default function MapComponent({
  region,
  onRegionChangeComplete,
  currentLocation,
  savedLocations,
}: MapComponentProps) {
  return (
    <View style={styles.mapPlaceholder}>
      <MapPin color={Colors.textSecondary} size={48} />
      <Text style={styles.mapPlaceholderText}>Map view available on mobile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  mapPlaceholderText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});