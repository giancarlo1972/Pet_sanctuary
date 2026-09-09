import React, { createElement, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NearbyMapProps, NearbyPin } from './NearbyMapProps';

function esc(s: string) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/"/g, '"');
}

function pinHtml(pin: NearbyPin, selected: boolean) {
  const label = pin.count != null ? String(pin.count) : (pin.initial || '');
  if (!label) return null;
  const size = selected ? 32 : 28;
  const font = pin.count != null && pin.count > 9 ? 10 : 11;
  return `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${esc(pin.color)};color:#fff;font:700 ${font}px/${size}px Inter,system-ui,sans-serif;text-align:center;border:${selected ? 3 : 2}px solid #fff;box-shadow:0 1px 4px rgba(38,38,94,.35)">${esc(label)}</div>`;
}

export default function NearbyMap(props: NearbyMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof document === 'undefined' || !host.current) return;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('ra-pin-css')) {
        const s = document.createElement('style');
        s.id = 'ra-pin-css';
        s.textContent = '.ra-pin{background:none!important;border:none!important}';
        document.head.appendChild(s);
      }
      const mod = await import('leaflet');
      const L = (mod as any).default || mod;
      if (cancelled || !host.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(host.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      map.setView([props.center.lat, props.center.lng], props.zoom ?? 12);
      setTimeout(() => map.invalidateSize(), 80);

      if (overlayRef.current) overlayRef.current.remove();
      const group = L.layerGroup();

      L.circle([props.center.lat, props.center.lng], {
        radius: Math.max(200, props.radiusKm * 1000),
        color: '#26265E',
        weight: 1,
        fillColor: '#26265E',
        fillOpacity: 0.07,
      }).addTo(group);

      L.circleMarker([props.center.lat, props.center.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#2E9E96',
        fillOpacity: 1,
      }).bindTooltip('You').addTo(group);

      for (const pin of props.pins) {
        const selected = pin.id === props.selectedId;
        const html = pinHtml(pin, selected);
        const marker = html
          ? L.marker([pin.lat, pin.lng], {
              icon: L.divIcon({
                className: 'ra-pin',
                html,
                iconSize: selected ? [32, 32] : [28, 28],
                iconAnchor: selected ? [16, 16] : [14, 14],
              }),
            })
          : L.circleMarker([pin.lat, pin.lng], {
              radius: selected ? 12 : 9,
              color: '#ffffff',
              weight: selected ? 3 : 2,
              fillColor: pin.color,
              fillOpacity: 1,
            });
        marker.bindTooltip(pin.title);
        marker.on('click', () => onSelectRef.current(pin));
        marker.addTo(group);
      }
      group.addTo(map);
      overlayRef.current = group;
    })();
    return () => { cancelled = true; };
  }, [props.center.lat, props.center.lng, props.radiusKm, props.pins, props.selectedId, props.zoom]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  return (
    <View style={styles.fill}>
      {createElement('div', {
        ref: host,
        style: { width: '100%', height: '100%', minHeight: 280, background: '#d9e2ec' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', minHeight: 280 },
});
