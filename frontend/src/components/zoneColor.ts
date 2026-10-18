import type { Zone } from '@/api/types';

export function zoneTone(zone: Zone | null | undefined): 'green' | 'yellow' | 'red' | 'none' {
  return zone ?? 'none';
}

/** Solid zone color (CSS variable) for markers, dots and bars. */
export function zoneColor(zone: Zone | null | undefined): string {
  return `var(--zone-${zoneTone(zone)})`;
}

/** Concrete hex values for canvas/WebGL (maplibre) where CSS variables are unavailable. Mirror tokens.css. */
export const ZONE_HEX = {
  green: '#466B56',
  yellow: '#806323',
  red: '#A34F3D',
  none: '#574941',
} as const;
