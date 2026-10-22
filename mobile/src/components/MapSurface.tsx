import type { Sighting } from '@/lib/types';

export type MapStatus = 'loading' | 'ready' | 'error';

export type MapSurfaceProps = {
  sightings: Sighting[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  centerCoordinate?: [number, number] | null;
  edge: string;
  onStatusChange?: (status: MapStatus) => void;
};

// Metro resolves the platform-specific implementation for the runtime bundle.
// This native re-export is only a TypeScript fallback for editor/type tooling.
export { default } from './MapSurface.native';
