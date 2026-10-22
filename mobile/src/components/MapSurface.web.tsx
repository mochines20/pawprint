import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { avatarChoice, avatarForVariant } from '@/lib/avatarCatalog';
import type { MapSurfaceProps } from './MapSurface';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const INITIAL_CENTER: [number, number] = [120.9842, 14.5995];
const MAP_WORKER_URL = '/maplibre-gl-worker.mjs';

export default function MapSurface({ sightings, selectedId, onSelect, centerCoordinate, edge, onStatusChange }: MapSurfaceProps) {
  const { width } = useWindowDimensions();
  const isCompactViewport = width > 0 && width < 768;
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const fittedPins = useRef(false);

  useEffect(() => {
    if (!container.current) return;
    setMapReady(false);
    onStatusChange?.('loading');
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
    // On phone-sized web layouts, the map is controlled with pinch/drag and the
    // floating locate button. Keep the zoom/compass stack for larger screens,
    // where it does not compete with the streak header.
    const showNavigationControls = !isCompactViewport;
    if (showNavigationControls) {
      instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    }
    instance.on('click', () => onSelect(null));
    instance.on('load', () => {
      setMapReady(true);
      onStatusChange?.('ready');
    });
    instance.on('error', () => {
      if (!instance.isStyleLoaded()) onStatusChange?.('error');
    });
    map.current = instance;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
  }, [isCompactViewport, onSelect, onStatusChange]);

  useEffect(() => {
    if (!map.current || !centerCoordinate) return;
    map.current.flyTo({ center: centerCoordinate, zoom: 14, duration: 450 });
  }, [centerCoordinate]);

  useEffect(() => {
    if (!map.current || !mapReady || fittedPins.current || sightings.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    sightings.forEach((sighting) => bounds.extend([sighting.lng, sighting.lat]));
    if (sightings.length === 1) {
      map.current.flyTo({ center: [sightings[0].lng, sightings[0].lat], zoom: 14, duration: 450 });
    } else {
      map.current.fitBounds(bounds, { padding: { top: 150, right: 48, bottom: 260, left: 48 }, maxZoom: 14, duration: 450 });
    }
    fittedPins.current = true;
  }, [mapReady, sightings]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = sightings.map((sighting) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'pawprint-map-pin';
      element.setAttribute('aria-label', `Open ${sighting.variant} cat pawprint`);
      element.title = sighting.emergency ? 'Care flag may be open for this cat' : 'Open cat pawprint';
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
      const avatar = avatarChoice(avatarForVariant(sighting.variant)).xml;
      element.innerHTML = `<span style="display:grid;place-items:center;width:34px;height:34px;transform:rotate(45deg);overflow:hidden;border-radius:11px;background:#fff">${avatar}</span>`;
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
  }, [edge, mapReady, onSelect, selectedId, sightings]);

  return <div ref={container} style={styles.map as React.CSSProperties} aria-label="Pawprint cat map" role="application" />;
}

const styles = StyleSheet.create({ map: { position: 'absolute', inset: 0 } });
