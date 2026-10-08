import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates } from '../types/environmental';

declare global { interface Window { google?: any; __airExpoGoogleMapsPromise?: Promise<void>; } }

interface Props { center: Coordinates; activeRoute: 'clean' | 'fast'; onRouteChange: (route: 'clean' | 'fast') => void; }

function loadGoogleMaps(key: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__airExpoGoogleMapsPromise) return window.__airExpoGoogleMapsPromise;
  window.__airExpoGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return window.__airExpoGoogleMapsPromise;
}

export const GoogleJoggingMap: React.FC<Props> = ({ center, activeRoute, onRouteChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<'google' | 'fallback'>('fallback');

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    let leafletMap: L.Map | null = null;
    let cancelled = false;
    const start = { lat: center.lat - 0.018, lng: center.lon - 0.018 };
    const end = { lat: center.lat + 0.014, lng: center.lon + 0.02 };
    const cleanPath = [start, { lat: center.lat - 0.004, lng: center.lon - 0.008 }, { lat: center.lat + 0.01, lng: center.lon + 0.006 }, end];
    const fastPath = [start, { lat: center.lat - 0.01, lng: center.lon + 0.006 }, end];

    const fallback = () => {
      if (cancelled || !element) return;
      leafletMap = L.map(element, { zoomControl: true }).setView([center.lat, center.lon], 13);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 18 }).addTo(leafletMap);
      L.polyline(cleanPath.map((p) => [p.lat, p.lng] as [number, number]), { color: '#ffd300', weight: activeRoute === 'clean' ? 7 : 4, opacity: activeRoute === 'clean' ? 1 : 0.55 }).addTo(leafletMap).on('click', () => onRouteChange('clean'));
      L.polyline(fastPath.map((p) => [p.lat, p.lng] as [number, number]), { color: '#f04b5b', weight: activeRoute === 'fast' ? 7 : 4, dashArray: '8 7', opacity: activeRoute === 'fast' ? 1 : 0.6 }).addTo(leafletMap).on('click', () => onRouteChange('fast'));
      L.circleMarker([start.lat, start.lng], { radius: 7, color: '#fff', fillColor: '#10162f', fillOpacity: 1, weight: 3 }).bindTooltip('Jog start', { permanent: true, direction: 'right' }).addTo(leafletMap);
      L.circleMarker([end.lat, end.lng], { radius: 7, color: '#fff', fillColor: '#3a10e5', fillOpacity: 1, weight: 3 }).bindTooltip('Destination', { permanent: true, direction: 'left' }).addTo(leafletMap);
      setProvider('fallback');
    };

    if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_BROWSER_KEY') {
      loadGoogleMaps(apiKey).then(() => {
        if (cancelled || !window.google?.maps) return;
        const map = new window.google.maps.Map(element, { center: { lat: center.lat, lng: center.lon }, zoom: 13, mapTypeId: 'satellite', streetViewControl: false, mapTypeControl: true });
        new window.google.maps.Polyline({ path: cleanPath, geodesic: true, strokeColor: '#ffd300', strokeOpacity: activeRoute === 'clean' ? 1 : 0.55, strokeWeight: activeRoute === 'clean' ? 7 : 4, map });
        new window.google.maps.Polyline({ path: fastPath, geodesic: true, strokeColor: '#f04b5b', strokeOpacity: activeRoute === 'fast' ? 1 : 0.55, strokeWeight: activeRoute === 'fast' ? 7 : 4, map });
        new window.google.maps.Marker({ position: start, map, title: 'Jog start' });
        new window.google.maps.Marker({ position: end, map, title: 'Destination' });
        setProvider('google');
      }).catch(fallback);
    } else fallback();

    return () => { cancelled = true; leafletMap?.remove(); element.replaceChildren(); };
  }, [center.lat, center.lon, activeRoute]);

  return <div className="lg:col-span-7 rounded-2xl overflow-hidden relative border border-primary min-h-[420px] bg-surface-container-low"><div ref={containerRef} className="absolute inset-0" /><div className="absolute top-3 left-12 z-[500] bg-white px-3 py-2 rounded shadow font-label-caps text-xs"><strong>{provider === 'google' ? 'Google Satellite' : 'Satellite fallback'}</strong> · Yellow = cleaner jog</div></div>;
};
