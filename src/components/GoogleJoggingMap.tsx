import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates } from '../types/environmental';

export type PlannedRoute = { id: string; coordinates: Coordinates[]; distanceKm: number; durationMin: number; exposure: number | null; aqi: number | null; pm2_5: number | null; pm10: number | null; observedAt: string | null; maxAqi?: number | null; sampleCount?: number; validSamples?: number; checkedAt?: string; };
interface Props { center: Coordinates; origin: Coordinates | null; destination: Coordinates | null; routes: PlannedRoute[]; selectedRoute: string | null; onSelectRoute: (id: string) => void; onMapPick: (point: Coordinates) => void; userLocation: Coordinates | null; }

export const GoogleJoggingMap: React.FC<Props> = ({ center, origin, destination, routes, selectedRoute, onSelectRoute, onMapPick, userLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onSelectRoute, onMapPick });
  callbacks.current = { onSelectRoute, onMapPick };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([center.lat, center.lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    map.on('click', (event) => callbacks.current.onMapPick({ lat: event.latlng.lat, lon: event.latlng.lng }));
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; layersRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    routes.forEach((route, index) => {
      if (route.coordinates.length < 2) return;
      const good = route.sampleCount! > 0 && route.validSamples === route.sampleCount && route.maxAqi != null && route.maxAqi <= 50;
      const color = good ? '#16834c' : route.maxAqi == null ? '#64748b' : route.maxAqi > 100 ? '#d44c55' : '#b7791f';
      const line = L.polyline(route.coordinates.map((p): [number, number] => [p.lat, p.lon]), { color, weight: selectedRoute === route.id ? 7 : 4, opacity: selectedRoute === route.id ? 0.96 : 0.58 }).addTo(layer);
      line.on('click', () => callbacks.current.onSelectRoute(route.id));
      line.bindTooltip(`Route ${index + 1} · ${route.distanceKm.toFixed(1)} km${good ? ' · sampled AQI Good' : ''}`);
    });
    if (origin) L.circleMarker([origin.lat, origin.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#16834c', fillOpacity: 1 }).bindTooltip('Origin').addTo(layer);
    if (destination) L.circleMarker([destination.lat, destination.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#e05263', fillOpacity: 1 }).bindTooltip('Destination').addTo(layer);
    if (userLocation) L.circleMarker([userLocation.lat, userLocation.lon], { radius: 7, color: '#fff', weight: 3, fillColor: '#2675e8', fillOpacity: 1 }).bindTooltip('Your current location').addTo(layer);
  }, [center.lat, center.lon, origin, destination, routes, selectedRoute, userLocation]);

  // AQI refreshes and route selection redraw layers without resetting a user's pan/zoom.
  const routeGeometry = JSON.stringify(routes.map(route => route.coordinates));
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (origin && destination) {
      const geometry = JSON.parse(routeGeometry) as Coordinates[][];
      const points: [number, number][] = geometry.flat().map(point => [point.lat, point.lon]);
      if (!points.length) points.push([origin.lat, origin.lon], [destination.lat, destination.lon]);
      map.fitBounds(L.latLngBounds(points).pad(0.15), { maxZoom: 15 });
    } else map.setView([center.lat, center.lon], map.getZoom());
  }, [center.lat, center.lon, origin?.lat, origin?.lon, destination?.lat, destination?.lon, routeGeometry]);

  return <div className="lg:col-span-7 relative isolate z-0 rounded-2xl overflow-hidden border border-primary h-[300px] sm:h-[360px] lg:h-[440px] bg-surface-container-low"><div ref={containerRef} className="absolute inset-0 z-0" /><div className="absolute top-3 left-12 right-3 sm:right-auto sm:max-w-sm z-10 bg-white/95 px-3 py-2 rounded shadow font-label-caps text-xs">OpenStreetMap<div className="mt-1 text-[10px] text-slate-600">Route pollution comes from coarse modeled grid samples, not street measurements. Click the map to set a destination.</div></div>{routes.length > 1 && routes.some((route) => route.exposure !== null) && <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-10 rounded bg-white/95 px-3 py-2 text-[11px] shadow">Green: all samples Good · amber/red: elevated AQI · grey: unavailable</div>}</div>;
};
