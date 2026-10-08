import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates } from '../types/environmental';
import { Layers, Globe, Radio, Crosshair, ZoomIn, ZoomOut, Wind, Sun, Satellite as SatIcon, Eye, Check } from 'lucide-react';
import { getAqiCategory } from '../services/openMeteoApi';

interface SatelliteViewerProps {
  coordinates: Coordinates;
  locationName: string;
  onSelectCoordinates?: (coords: Coordinates) => void;
  currentAqi?: number;
  windDirection?: number;
  windSpeed?: number;
  pm25?: number;
  cloudCover?: number;
  elevation?: number;
}

interface SatelliteLayerOption {
  id: string;
  name: string;
  source: string;
  sensor: string;
  resolution: string;
  type: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

interface AqiStation { id: string; name: string; lat: number; lon: number; aqi: number; }

export const SATELLITE_LAYERS: SatelliteLayerOption[] = [
  {
    id: 'esri-hd',
    name: 'High-Res Optical Satellite',
    source: 'Esri World Imagery',
    sensor: 'DigitalGlobe / Maxar & Copernicus',
    resolution: '0.3m – 15m Multispectral',
    type: 'Surface Topography & Urban Geometry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, CNES/Airbus DS',
    maxZoom: 18,
  },
  {
    id: 'nasa-truecolor',
    name: 'NASA GIBS MODIS TrueColor',
    source: 'NASA EOSDIS GIBS',
    sensor: 'MODIS Terra & Aqua',
    resolution: '250m Sub-daily Global Mosaic',
    type: 'Real-time Atmospheric Reflectance & Clouds',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attribution: 'Imagery &copy; NASA EOSDIS GIBS',
    maxZoom: 9,
  },
  {
    id: 'nasa-aod',
    name: 'NASA Aerosol Optical Depth',
    source: 'NASA EOSDIS GIBS / MODIS',
    sensor: 'MODIS Aerosol Optical Depth 3km',
    resolution: '3km Tropospheric Aerosol Column',
    type: 'Particulate Density & Wildfire Plumes',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol_Optical_Depth_Land_Ocean_3km/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
    attribution: 'Imagery &copy; NASA Earthdata GIBS',
    maxZoom: 6,
  },
  {
    id: 'nasa-night',
    name: 'NASA Earth At Night (VIIRS)',
    source: 'NASA Suomi NPP VIIRS',
    sensor: 'Day/Night Band (DNB)',
    resolution: '750m Nocturnal Radiance',
    type: 'Anthropogenic Emissions & Radiance',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    attribution: 'Imagery &copy; NASA Suomi NPP / NOAA',
    maxZoom: 8,
  },
  {
    id: 'carto-clean',
    name: 'Clean Cartographic Base',
    source: 'CartoDB Positron',
    sensor: 'OpenStreetMap Hydrography',
    resolution: 'Vector Cartography',
    type: 'Atmospheric Boundary Reference',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
];

// Calculate astronomical Solar Zenith Angle
function calculateSolarZenithAngle(lat: number, lon: number, date = new Date()): number {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma);
  const timeOffset = lon * 4; // minutes
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarTime = (utcHours + timeOffset / 60 + 24) % 24;
  const hourAngle = (solarTime - 12) * 15 * (Math.PI / 180);
  const latRad = lat * (Math.PI / 180);
  const cosZenith = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);
  const zenithRad = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  return Math.round(zenithRad * (180 / Math.PI) * 10) / 10;
}

export const SatelliteViewer: React.FC<SatelliteViewerProps> = ({
  coordinates,
  locationName,
  onSelectCoordinates,
  currentAqi = 238,
  windDirection = 310,
  windSpeed = 6,
  pm25 = 120.4,
  cloudCover = 10,
  elevation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const plumeLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeLayerId, setActiveLayerId] = useState<string>('esri-hd');
  const [zoomLevel, setZoomLevel] = useState<number>(11);
  const [showPlume, setShowPlume] = useState<boolean>(true);
  const [probedCoords, setProbedCoords] = useState<Coordinates>(coordinates);
  const [aqicnConfigured, setAqicnConfigured] = useState<boolean | null>(null);

  const activeLayer = SATELLITE_LAYERS.find((l) => l.id === activeLayerId) || SATELLITE_LAYERS[0];
  const aqiCat = getAqiCategory(currentAqi);

  // Compute remote sensing telemetry
  const solarZenithAngle = calculateSolarZenithAngle(coordinates.lat, coordinates.lon);
  const estimatedAod = Math.min(2.5, Math.max(0.04, Math.round((pm25 / 110) * 100) / 100));

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coordinates.lat, coordinates.lon],
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
      });

      // Custom marker icon
      const customIcon = L.divIcon({
        className: 'custom-satellite-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            <div style="position: absolute; width: 32px; height: 32px; background-color: rgba(11, 122, 138, 0.35); border-radius: 9999px; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 16px; height: 16px; background-color: #0B7A8A; border: 3px solid #ffffff; border-radius: 9999px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([coordinates.lat, coordinates.lon], { icon: customIcon }).addTo(map);
      markerRef.current = marker;

      // Layer group for AQI Plume
      const plumeGroup = L.layerGroup().addTo(map);
      plumeLayerRef.current = plumeGroup;
      stationLayerRef.current = L.layerGroup().addTo(map);

      // Click probe
      map.on('click', (e: L.LeafletMouseEvent) => {
        const newCoords = { lat: e.latlng.lat, lon: e.latlng.lng };
        setProbedCoords(newCoords);
        if (onSelectCoordinates) {
          onSelectCoordinates(newCoords);
        }
      });

      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const maxZoom = activeLayer.maxZoom || 18;
    const currentZoom = map.getZoom();
    if (currentZoom > maxZoom) {
      map.setZoom(maxZoom);
    }

    const newLayer = L.tileLayer(activeLayer.url, {
      attribution: activeLayer.attribution,
      maxZoom: maxZoom,
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [activeLayerId]);

  // Update view & plume when coordinates or AQI change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentZoom = Math.min(map.getZoom(), activeLayer.maxZoom || 18);
    map.flyTo([coordinates.lat, coordinates.lon], currentZoom, { duration: 1.2 });

    if (markerRef.current) {
      markerRef.current.setLatLng([coordinates.lat, coordinates.lon]);
    }
    setProbedCoords(coordinates);

    // Render Atmospheric Dispersion Plume Overlay
    if (plumeLayerRef.current) {
      plumeLayerRef.current.clearLayers();

      if (showPlume) {
        // Base concentric dispersion circles
        const circleInner = L.circle([coordinates.lat, coordinates.lon], {
          radius: 2500,
          color: aqiCat.color,
          fillColor: aqiCat.color,
          fillOpacity: 0.35,
          weight: 2,
        });

        const circleOuter = L.circle([coordinates.lat, coordinates.lon], {
          radius: 5500,
          color: aqiCat.color,
          fillColor: aqiCat.color,
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4, 4',
        });

        // Downwind dispersion cone
        // Downwind angle is (windDirection + 180) % 360
        const downwindRad = (((windDirection + 180) % 360) * Math.PI) / 180;
        const spreadRad = (28 * Math.PI) / 180;
        const plumeDistance = 0.08; // ~8-9 km in lat/lon offset

        const p1: [number, number] = [coordinates.lat, coordinates.lon];
        const p2: [number, number] = [
          coordinates.lat + plumeDistance * Math.cos(downwindRad - spreadRad),
          coordinates.lon + (plumeDistance / Math.cos((coordinates.lat * Math.PI) / 180)) * Math.sin(downwindRad - spreadRad),
        ];
        const p3: [number, number] = [
          coordinates.lat + plumeDistance * Math.cos(downwindRad + spreadRad),
          coordinates.lon + (plumeDistance / Math.cos((coordinates.lat * Math.PI) / 180)) * Math.sin(downwindRad + spreadRad),
        ];

        const plumeCone = L.polygon([p1, p2, p3], {
          color: aqiCat.color,
          fillColor: aqiCat.color,
          fillOpacity: 0.22,
          weight: 1,
        });

        circleInner.addTo(plumeLayerRef.current);
        circleOuter.addTo(plumeLayerRef.current);
        plumeCone.addTo(plumeLayerRef.current);
      }
    }
  }, [coordinates.lat, coordinates.lon, currentAqi, windDirection, showPlume]);

  // Load nearby AQICN monitoring stations so the satellite surface shows AQI
  // location-by-location rather than only the selected target.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/aqi/nearby?lat=${coordinates.lat}&lon=${coordinates.lon}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setAqicnConfigured(Boolean(payload.configured));
        const stationGroup = stationLayerRef.current;
        if (!stationGroup) return;
        stationGroup.clearLayers();
        (payload.stations || []).forEach((station: AqiStation) => {
          const category = getAqiCategory(station.aqi);
          L.circleMarker([station.lat, station.lon], {
            radius: 15,
            color: '#ffffff',
            weight: 3,
            fillColor: category.color,
            fillOpacity: 0.95,
          }).bindTooltip(`<strong>${station.name}</strong><br/>AQI ${station.aqi} · ${category.label}`, { direction: 'top' })
            .bindPopup(`<strong>${station.name}</strong><br/>Real-time AQI: ${station.aqi}<br/><small>Source: World Air Quality Index Project</small>`)
            .addTo(stationGroup);
        });
      })
      .catch((error) => {
        console.warn('Unable to render nearby AQICN stations:', error);
        setAqicnConfigured(false);
      });
    return () => { cancelled = true; };
  }, [coordinates.lat, coordinates.lon]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all border border-surface-container/60">
      {/* Top Header & Layer Selection */}
      <div className="p-space-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest border-b border-surface-container">
        <div>
          <div className="flex items-center gap-space-xs text-primary font-label-caps text-label-caps uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 text-primary animate-pulse" />
            <span>Earth Observation Studio · Satellite AQI Telemetry</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Real-Time Satellite & Optical Remote Sensing
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-label-md font-label-md text-on-surface-variant mt-1">
            <span>Target: <strong className="text-on-surface font-semibold">{locationName}</strong></span>
            <span>•</span>
            <span className="tabular-nums">Lat: {probedCoords.lat.toFixed(4)}°</span>
            <span>•</span>
            <span className="tabular-nums">Lon: {probedCoords.lon.toFixed(4)}°</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold" style={{ color: aqiCat.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aqiCat.color }}></span>
              AQI {currentAqi} ({aqiCat.label})
            </span>
          </div>
        </div>

        {/* Layer Selector & Plume Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Plume toggle button */}
          <button
            onClick={() => setShowPlume(!showPlume)}
            className={`px-3 py-1.5 text-xs font-label-md rounded-xl border transition-all flex items-center gap-1.5 ${
              showPlume
                ? 'bg-secondary-container text-on-secondary-container border-secondary/30 font-semibold shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant border-transparent hover:text-on-surface'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{showPlume ? 'AQI Plume Active' : 'Show AQI Plume'}</span>
          </button>

          {/* Layer buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1.5 rounded-xl shadow-inner">
            {SATELLITE_LAYERS.map((layer) => {
              const isSelected = layer.id === activeLayerId;
              return (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`px-3 py-1.5 text-xs font-label-md rounded-lg transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-on-primary font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                  }`}
                >
                  {layer.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map Viewport Area */}
      <div className="relative w-full h-[520px] bg-surface-container-low">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Zoom & Probe Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="w-10 h-10 bg-surface-container-lowest/90 backdrop-blur-md rounded-xl flex items-center justify-center text-on-surface hover:bg-surface-container shadow-md transition-all active:scale-90"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="w-10 h-10 bg-surface-container-lowest/90 backdrop-blur-md rounded-xl flex items-center justify-center text-on-surface hover:bg-surface-container shadow-md transition-all active:scale-90"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([coordinates.lat, coordinates.lon], 11);
              }
            }}
            aria-label="Reset center"
            className="w-10 h-10 bg-surface-container-lowest/90 backdrop-blur-md rounded-xl flex items-center justify-center text-primary hover:bg-surface-container shadow-md transition-all active:scale-90"
            title="Recenter on target"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Active Satellite Telemetry Hud Overlay */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-10 bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-space-md shadow-lg text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
            <span className="font-semibold text-on-surface font-title-md flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-primary" />
              {activeLayer.source}
            </span>
            <span className="text-label-caps font-label-caps text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              Res: {activeLayer.resolution}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label-caps font-label-caps text-on-surface-variant">
            <div>
              <span>Sensor Payload: </span>
              <strong className="text-on-surface font-semibold">{activeLayer.sensor}</strong>
            </div>
            <div>
              <span>Orbit Type: </span>
              <strong className="text-on-surface font-semibold">Sun-Sync (705 km)</strong>
            </div>
            <div>
              <span>Solar Zenith Angle: </span>
              <strong className="text-on-surface font-semibold tabular-nums">{solarZenithAngle}°</strong>
            </div>
            <div>
              <span>Est. Column AOD: </span>
              <strong className="text-primary font-semibold tabular-nums">{estimatedAod}</strong>
            </div>
            <div>
              <span>Cloud Attenuation: </span>
              <strong className="text-on-surface font-semibold tabular-nums">{cloudCover}%</strong>
            </div>
            <div>
              <span>Surface Dispersion: </span>
              <strong className="text-on-surface font-semibold tabular-nums">{windSpeed} km/h ({windDirection}°)</strong>
            </div>
            <div className="col-span-2 pt-1 border-t border-surface-container text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              <span>Click anywhere on satellite surface to probe live coordinates & AQI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Satellite Imagery Footnote & Global Calibration */}
      <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-label-caps font-label-caps text-on-surface-variant">
        <div className="flex items-center gap-2">
              <span>Telemetry Feeds: NASA EOSDIS GIBS • USGS/Esri • {aqicnConfigured ? 'AQICN live stations' : 'AQICN token required'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Zoom: {zoomLevel}x</span>
          <span>•</span>
          <span>Overpass Window: ~10:30 & 13:30 LST</span>
          <span>•</span>
          <span>Datum: WGS84 Web Mercator</span>
        </div>
      </div>
    </div>
  );
};
