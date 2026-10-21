import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map as MapLibreMap, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { PinMarker } from '@/components/PinMarker';
import type { MapSurfaceProps } from './MapSurface';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const INITIAL_CENTER: [number, number] = [120.9842, 14.5995];

export default function MapSurface({ sightings, selectedId, onSelect, centerCoordinate, edge }: MapSurfaceProps) {
  const camera = useRef<any>(null);
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: sightings.map((s) => ({
      type: 'Feature',
      id: s.id,
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { mine: s.mine },
    })),
  }), [sightings]);

  useEffect(() => {
    if (!centerCoordinate) return;
    camera.current?.flyTo({ center: centerCoordinate, duration: 450, zoom: 14 });
  }, [centerCoordinate]);

  return (
    <MapLibreMap
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE}
      attribution
      compass
      onPress={() => onSelect(null)}
    >
      <Camera ref={camera} initialViewState={{ center: INITIAL_CENTER, zoom: 5.4 }} />
      <UserLocation accuracy />
      <GeoJSONSource id="pawprint-sightings" data={data}>
        <Layer
          id="pawprint-areas"
          type="circle"
          source="pawprint-sightings"
          style={{
            circleRadius: 26,
            circleColor: '#FFB400',
            circleOpacity: 0.2,
            circleStrokeColor: edge,
            circleStrokeWidth: 2,
            circleStrokeOpacity: 0.7,
          }}
        />
      </GeoJSONSource>
      {sightings.map((s) => (
        <Marker key={s.id} id={s.id} lngLat={[s.lng, s.lat]} anchor="bottom" onPress={() => onSelect(s.id)}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open pawprint" style={styles.markerHitbox}>
            <PinMarker fill={s.mine ? '#FFB400' : '#FAF8F4'} selected={s.id === selectedId} />
          </Pressable>
        </Marker>
      ))}
    </MapLibreMap>
  );
}

const styles = StyleSheet.create({
  markerHitbox: { alignItems: 'center', justifyContent: 'center', minWidth: 52, minHeight: 58 },
});
