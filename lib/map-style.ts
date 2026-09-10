/** Basemap: OSM raster (no API key). OpenFreeMap Positron is MapLibre-only and
 *  was hiding the raster fallback when WebGL/style never painted. CartoDB
 *  Positron watermarks every tile with "API KEY REQUIRED". */

export const OSM_RASTER_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Light-grey raster if OSM 429s. No API key. {z}/{y}/{x} order. */
export const ESRI_LIGHT_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

export const BASEMAP_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const PIN_CORAL = '#E85A50';
export const PIN_HALO_FILL = 'rgba(232,90,80,0.18)';
export const PIN_HALO_STROKE = 'rgba(232,90,80,0.5)';
export const PIN_HALO_METERS = 300;
