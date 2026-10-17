import type { Map as MapLibreMap, StyleSpecification } from '@/lib/maplibre';

const CUSTOM_MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL;

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  return CUSTOM_MAP_STYLE_URL || `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'bright'}`;
}

/** MapLibre's controls and attribution need important overrides because its CSS is unlayered. */
export const MAP_CONTROLS_CLASS = [
  '[&_.maplibregl-ctrl-group]:rounded! [&_.maplibregl-ctrl-group]:border! [&_.maplibregl-ctrl-group]:border-border-strong! [&_.maplibregl-ctrl-group]:bg-surface-raised! [&_.maplibregl-ctrl-group]:shadow-none!',
  '[&_.maplibregl-ctrl-group_button]:border-border! [&_.maplibregl-ctrl-icon]:invert-0! dark:[&_.maplibregl-ctrl-icon]:invert! [&_.maplibregl-ctrl-group_button:hover]:bg-hover!',
  '[&_.maplibregl-ctrl-attrib]:bg-surface-glass! [&_.maplibregl-ctrl-attrib]:text-text-3! [&_.maplibregl-ctrl-attrib_a]:text-text-2!',
  '[&_.maplibregl-ctrl-attrib-button]:invert-0! dark:[&_.maplibregl-ctrl-attrib-button]:invert!',
].join(' ');

/** Used when the style above cannot be loaded (offline, blocked host): plain OpenStreetMap raster tiles. */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** Overview of Kazakhstan, used while there is nothing to fit to. */
export const KAZAKHSTAN_VIEW = { center: [66.9, 48.0] as [number, number], zoom: 3.4 };

export const CITY_ZOOM = 10.5;

/** MapLibre cannot read CSS variables, so design tokens are resolved to concrete colors. */
export function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Aligns map chrome with the app palette while preserving the provider's full light/dark cartography.
 */
export function recolorBasemap(map: MapLibreMap, theme: 'light' | 'dark'): void {
  const background = readToken('--bg');
  const border = readToken('--border-strong');
  const label = readToken('--text-3');
  const set = (id: string, property: Parameters<MapLibreMap['setPaintProperty']>[1], value: string) => map.setPaintProperty(id, property, value);

  for (const layer of map.getStyle().layers) {
    const { id } = layer;
    switch (layer.type) {
      case 'raster':
        // Keep semantic marker colors intact while reducing raster glare only in dark mode.
        map.setPaintProperty(id, 'raster-brightness-max', theme === 'dark' ? 0.55 : 1);
        map.setPaintProperty(id, 'raster-saturation', theme === 'dark' ? -0.4 : 0);
        map.setPaintProperty(id, 'raster-contrast', theme === 'dark' ? 0.1 : 0);
        break;
      case 'background':
        // The style already has distinct land, water, park and road colors. Only fill-map gaps with the page surface.
        set(id, 'background-color', background);
        break;
      case 'line':
        if (id.startsWith('boundary')) set(id, 'line-color', border);
        break;
      case 'symbol':
        if (layer.layout?.['text-field'] === undefined) break;
        set(id, 'text-color', label);
        set(id, 'text-halo-color', background);
        break;
    }
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let webGlAvailable: boolean | undefined;

/** MapLibre throws while constructing the map when no WebGL2 context can be created. */
export function isWebGlAvailable(): boolean {
  if (webGlAvailable === undefined) {
    const context = document.createElement('canvas').getContext('webgl2');
    webGlAvailable = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webGlAvailable;
}
