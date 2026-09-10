import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { NearbyMapProps } from './NearbyMapProps';
import {
  PIN_CORAL,
  PIN_HALO_FILL,
  PIN_HALO_METERS,
  PIN_HALO_STROKE,
} from '@/lib/map-style';

function glyphOf(pin: { glyph?: string; count?: number; initial?: string }) {
  if (pin.glyph) return pin.glyph;
  if (pin.count != null) return String(pin.count);
  return pin.initial || '•';
}

export default function NearbyMap(props: NearbyMapProps) {
  const lat = props.center.lat;
  const lng = props.center.lng;
  const mode = props.mode || 'nearby';
  const compact = mode === 'pin';
  const latDelta = compact ? 0.008 : Math.max(0.04, (props.radiusKm / 111) * 2.4);
  return (
    <MapView
      style={[styles.fill, compact && styles.compact]}
      initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: latDelta }}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      userInterfaceStyle="light"
    >
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
        radius={14}
        strokeColor={PIN_HALO_STROKE}
        fillColor={PIN_CORAL}
        strokeWidth={2}
      />
      {mode === 'nearby'
        ? props.pins.map((pin) => (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title={pin.title}
              description={pin.subtitle}
              onPress={() => props.onSelect(pin)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.dropWrap}>
                <View style={[styles.drop, { backgroundColor: pin.color }]}>
                  <Text style={styles.dropTxt}>{glyphOf(pin)}</Text>
                </View>
              </View>
            </Marker>
          ))
        : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
  compact: { height: 200, minHeight: 200, flex: 0 },
  dropWrap: { width: 36, height: 44, alignItems: 'center' },
  drop: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dropTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    transform: [{ rotate: '45deg' }],
  },
});
