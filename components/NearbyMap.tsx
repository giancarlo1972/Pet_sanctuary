import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { NearbyMapProps } from './NearbyMapProps';

export default function NearbyMap(props: NearbyMapProps) {
  const lat = props.center.lat;
  const lng = props.center.lng;
  const latDelta = Math.max(0.04, (props.radiusKm / 111) * 2.4);
  const lonDelta = latDelta;
  return (
    <MapView
      style={styles.fill}
      region={{ latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lonDelta }}
      onPress={() => {}}
    >
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={Math.max(200, props.radiusKm * 1000)}
        strokeColor="rgba(38,38,94,0.45)"
        fillColor="rgba(38,38,94,0.07)"
        strokeWidth={1}
      />
      <Marker coordinate={{ latitude: lat, longitude: lng }} title="You" pinColor="#2E9E96" />
      {props.pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title={pin.title}
          description={pin.subtitle}
          pinColor={pin.color}
          onPress={() => props.onSelect(pin)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
});
