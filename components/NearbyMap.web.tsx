import React, { createElement, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NearbyMapProps, NearbyPin } from './NearbyMapProps';
import {
  PIN_CORAL,
  PIN_HALO_FILL,
  PIN_HALO_METERS,
  PIN_HALO_STROKE,
  POSITRON_STYLE,
} from '@/lib/map-style';

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => {
    if (c === '&') return '\u0026amp;';
    if (c === '<') return '\u0026lt;';
    if (c === '>') return '\u0026gt;';
    if (c === '"') return '\u0026quot;';
    return '\u0026#39;';
  });
}

function circlePoly(lat: number, lng: number, meters: number, n = 64) {
  const coords: [number, number][] = [];
  const rLat = meters / 111320;
  const rLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    coords.push([lng + rLng * Math.cos(a), lat + rLat * Math.sin(a)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

function teardropEl(color: string, glyph: string, outline?: boolean) {
  const el = document.createElement('div');
  el.className = 'ra-pin-icon';
  if (outline) {
    el.innerHTML = `<div class="ra-pin-drop ra-pin-outline" style="background:#fff;border-color:${esc(color)}"><span style="color:${esc(color)}">${esc(glyph)}</span></div>`;
  } else {
    el.innerHTML = `<div class="ra-pin-drop" style="background:${esc(color)}"><span>${esc(glyph)}</span></div>`;
  }
  return el;
}

function pinGlyph(pin: NearbyPin) {
  if (pin.glyph) return pin.glyph;
  if (pin.count != null) return String(pin.count);
  return pin.initial || '';
}

function ensureCss() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('maplibre-css')) {
    const link = document.createElement('link');
    link.id = 'maplibre-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('ra-pin-css')) {
    const s = document.createElement('style');
    s.id = 'ra-pin-css';
    s.textContent = `
      .ra-pin-icon{background:none!important;border:none!important}
      .ra-pin-drop{
        width:36px;height:36px;border-radius:50% 50% 50% 4px;
        border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);
        display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);
      }
      .ra-pin-drop span{transform:rotate(45deg);color:#fff;font:700 13px/1 Inter,system-ui,sans-serif}
      .ra-pin-drop.ra-pin-outline{border-width:3px}
      .ra-pin-drop.ra-pin-outline span{color:inherit}
      .maplibregl-ctrl-attrib{font-size:10px}
    `;
    document.head.appendChild(s);
  }
}

export default function NearbyMap(props: NearbyMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;
  const mode = props.mode || 'nearby';
  const compact = mode === 'pin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof document === 'undefined' || !host.current) return;
      ensureCss();
      const mod = await import('maplibre-gl');
      const maplibregl = (mod as any).default || mod;
      if (cancelled || !host.current) return;

      if (!mapRef.current) {
        mapRef.current = new maplibregl.Map({
          container: host.current,
          style: POSITRON_STYLE,
          center: [props.center.lng, props.center.lat],
          zoom: props.zoom ?? (compact ? 16 : 12),
          attributionControl: true,
          fadeDuration: 0,
          interactive: mode === 'nearby',
        });
      }
      const map = mapRef.current;
      const paint = () => {
        if (cancelled) return;
        map.resize();
        for (const m of markersRef.current) m.remove();
        markersRef.current = [];

        const halo = circlePoly(props.center.lat, props.center.lng, compact ? PIN_HALO_METERS : Math.max(200, props.radiusKm * 1000));
        if (map.getSource('ra-halo')) {
          map.getSource('ra-halo').setData(halo);
        } else {
          map.addSource('ra-halo', { type: 'geojson', data: halo });
          map.addLayer({
            id: 'ra-halo-fill', type: 'fill', source: 'ra-halo',
            paint: { 'fill-color': compact ? PIN_HALO_FILL : 'rgba(38,38,94,0.07)', 'fill-opacity': 1 },
          });
          map.addLayer({
            id: 'ra-halo-line', type: 'line', source: 'ra-halo',
            paint: { 'line-color': compact ? PIN_HALO_STROKE : 'rgba(38,38,94,0.45)', 'line-width': compact ? 2 : 1 },
          });
        }

        const dot = document.createElement('div');
        dot.style.cssText = `width:16px;height:16px;border-radius:50%;background:${PIN_CORAL};border:2px solid ${PIN_HALO_STROKE};box-shadow:0 0 0 6px ${PIN_HALO_FILL}`;
        markersRef.current.push(new maplibregl.Marker({ element: dot, anchor: 'center' }).setLngLat([props.center.lng, props.center.lat]).addTo(map));

        if (mode === 'nearby') {
          for (const pin of props.pins) {
            const glyph = pinGlyph(pin);
            const el = teardropEl(pin.color, glyph || '•', pin.outline);
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectRef.current(pin);
            });
            markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map));
          }
        }

        map.jumpTo({ center: [props.center.lng, props.center.lat], zoom: props.zoom ?? (compact ? 16 : 12) });
      };

      if (map.loaded() && map.isStyleLoaded()) paint();
      else map.once('load', paint);
    })();
    return () => { cancelled = true; };
  }, [props.center.lat, props.center.lng, props.radiusKm, props.pins, props.selectedId, props.zoom, mode, compact]);

  useEffect(() => () => {
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  return (
    <View style={[styles.fill, compact && styles.compact]}>
      {createElement('div', {
        ref: host,
        'data-basemap': 'positron',
        style: { width: '100%', height: '100%', minHeight: compact ? 200 : 280, background: '#EAEDF2' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', minHeight: 280 },
  compact: { minHeight: 200, flex: 0, height: 200 },
});
