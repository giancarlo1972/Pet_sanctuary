import React from 'react';
import { Platform } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';

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
  region: Region;
  onRegionChangeComplete: (region: Region) => void;
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
    <MapView
      style={{ flex: 1 }}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {currentLocation && (
        <Marker
          coordinate={{
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }}
          title="Current Location"
          pinColor={Colors.primary}
        />
      )}
      {savedLocations.map(location => (
        <Marker
          key={location.id}
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title={location.name}
          description={location.address}
          pinColor={location.isFavorite ? Colors.warning : Colors.secondary}
        />
      ))}
    </MapView>
  );
}