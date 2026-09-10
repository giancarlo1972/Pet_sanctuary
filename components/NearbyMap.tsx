import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Circle, Marker, UrlTile } from 'react-native-maps';
import type { NearbyMapProps } from './NearbyMapProps';
import {
  OSM_RASTER_URL,
  PIN_CORAL,
  PIN_HALO_FILL,
  PIN_HALO_METERS,
  PIN_HALO_STROKE,
} from '@/lib/map-style';

export default function NearbyMap(props: NearbyMapProps) {
  const lat = props.center.lat;
  const lng = props.center.lng;
  const mode = props.mode || 'nearby';
  const compact = mode === 'pin';
  const latDelta = compact ? 0.008 : Math.max(0.04, (props.radiusKm / 111) * 2.4);
  const lonDelta = latDelta;
  return (
    <MapView
      style={[styles.fill, compact && styles.compact]}
      mapType="none"
      region={{ latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lonDelta }}
      onPress={() => {}}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
    >
      <UrlTile urlTemplate={OSM_RASTER_URL} maximumZ={19} zIndex={-1} />
      {mode === 'nearby' ? (
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={Math.max(200, props.radiusKm * 1000)}
          strokeColor="rgba(38,38,94,0.45)"
          fillColor="rgba(38,38,94,0.07)"
          strokeWidth={1}
        />
      ) : null}
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={PIN_HALO_METERS}
        strokeColor={PIN_HALO_STROKE}
        fillColor={PIN_HALO_FILL}
        strokeWidth={2}
      />
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={12}
        strokeColor="#ffffff"
        fillColor={PIN_CORAL}
        strokeWidth={3}
      />
      {mode === 'nearby' ? props.pins.map((pin) => {
        const label = pin.count != null ? String(pin.count) : pin.initial;
        if (!label) {
          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title={pin.title}
              description={pin.subtitle}
              pinColor={pin.color}
              onPress={() => props.onSelect(pin)}
            />
          );
        }
        return (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            title={pin.title}
            description={pin.subtitle}
            onPress={() => props.onSelect(pin)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.bubble, { backgroundColor: pin.color, borderWidth: pin.id === props.selectedId ? 3 : 2 }]}>
              <Text style={styles.bubbleTxt}>{label}</Text>
            </View>
          </Marker>
        );
      }) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
  compact: { height: 200, minHeight: 200, flex: 0 },
  bubble: {
    minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderColor: '#fff',
  },
  bubbleTxt: { color: '#fff', fontWeight: '700', fontSize: 11 },
});
