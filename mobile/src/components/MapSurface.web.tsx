import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapSurfaceProps } from './MapSurface';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const INITIAL_CENTER: [number, number] = [120.9842, 14.5995];
const MAP_WORKER_URL = '/maplibre-gl-worker.mjs';

export default function MapSurface({ sightings, selectedId, onSelect, centerCoordinate, edge }: MapSurfaceProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current) return;
    // Expo web does not automatically resolve MapLibre's worker bundle.
    // Point it at the worker copied into `mobile/public` so the style and
    // vector tiles can render in the browser as well as in native builds.
    maplibregl.setWorkerUrl(MAP_WORKER_URL);
    const instance = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: 5.4,
      minZoom: 4,
      maxZoom: 18,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instance.on('click', () => onSelect(null));
    map.current = instance;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    if (!map.current || !centerCoordinate) return;
    map.current.flyTo({ center: centerCoordinate, zoom: 14, duration: 450 });
  }, [centerCoordinate]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = sightings.map((sighting) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'pawprint-map-pin';
      element.setAttribute('aria-label', 'Open pawprint');
      element.style.width = '48px';
      element.style.height = '48px';
      element.style.display = 'flex';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.style.background = sighting.mine ? '#FFB400' : '#FAF8F4';
      element.style.border = `2.5px solid ${edge}`;
      element.style.borderRadius = '50% 50% 50% 0';
      element.style.boxShadow = `0 3px 0 ${edge}`;
      element.style.transform = `rotate(-45deg)${sighting.id === selectedId ? ' scale(1.18)' : ''}`;
      element.style.cursor = 'pointer';
      element.style.padding = '0';
      element.innerHTML = '<span style="transform:rotate(45deg);font-size:22px;line-height:1">🐾</span>';
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect(sighting.id);
      });
      return new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([sighting.lng, sighting.lat])
        .addTo(map.current!);
    });
    return () => {
      markers.current.forEach((marker) => marker.remove());
    };
  }, [edge, onSelect, selectedId, sightings]);

  return <div ref={container} style={styles.map as React.CSSProperties} />;
}

const styles = StyleSheet.create({ map: { position: 'absolute', inset: 0 } });
