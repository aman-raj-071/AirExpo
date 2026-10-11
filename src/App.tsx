import React, { useState, useEffect, useRef } from 'react';
import { UserRound } from 'lucide-react';
import {
  Coordinates,
  DiagnosticReport,
  EnvironmentalStationData,
  HourlyDataPoint,
  LocationInfo,
} from './types/environmental';
import {
  PRESET_LOCATIONS,
  fetchEnvironmentalData,
  searchLocations,
  reverseGeocode,
} from './services/openMeteoApi';
import { fetchAiDiagnostic } from './services/aiDiagnosticService';
import type { PlannedRoute } from './components/GoogleJoggingMap';
import { OpenMeteoLivePanel } from './components/OpenMeteoLivePanel';
import { AqiGlobe } from './components/AqiGlobe';
const GoogleJoggingMap = React.lazy(() => import('./components/GoogleJoggingMap').then((module) => ({ default: module.GoogleJoggingMap })));
const HealthWorkspace = React.lazy(() => import('./components/HealthWorkspace').then((module) => ({ default: module.HealthWorkspace })));
const UserHealthProfile = React.lazy(() => import('./components/UserHealthProfile').then((module) => ({ default: module.UserHealthProfile })));
const AirAlerts = React.lazy(() => import('./components/AirAlerts').then((module) => ({ default: module.AirAlerts })));
const ComparisonMatrix = React.lazy(() => import('./components/ComparisonMatrix').then((module) => ({ default: module.ComparisonMatrix })));
import { MountainBackdrop, DayPeriod } from './components/MountainBackdrop';
import { sampleRouteAirQuality, recommendRoute, isGoodRoute } from './services/routeAirQuality';
import { translateDocument } from './services/i18n';
import { cloudRequest } from './services/cloudStorage';
import { routeRequest } from './services/routeApi';

// Default initial location: Rohini, Delhi
const INITIAL_LOCATION: LocationInfo = {
  name: 'Rohini, Delhi',
  country: 'India',
  admin1: 'Delhi',
  latitude: 28.7041,
  longitude: 77.1025,
  timezone: 'Asia/Kolkata',
};
const MONITORING_LOCATION_STORAGE_KEY = 'airexpo-monitoring-location';

function getInitialMonitoringLocation(): LocationInfo {
  try {
    const stored = window.sessionStorage.getItem(MONITORING_LOCATION_STORAGE_KEY);
    if (stored) {
      const location = JSON.parse(stored) as Partial<LocationInfo>;
      if (
        typeof location.name === 'string'
        && Number.isFinite(location.latitude)
        && Number.isFinite(location.longitude)
        && Math.abs(location.latitude!) <= 90
        && Math.abs(location.longitude!) <= 180
      ) {
        return { country: '', ...location } as LocationInfo;
      }
    }
  } catch {
    // Keep the default usable when tab storage is unavailable or invalid.
  }
  return INITIAL_LOCATION;
}

function getTimeBasedGreeting(timeZone?: string, timestamp = Date.now()) {
  const now = new Date(timestamp);
  let hour = now.getHours();
  if (timeZone) {
    try {
      hour = Number(new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now));
    } catch {
      // Fall back to the device's local time if the location has no valid IANA zone.
    }
  }

  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

type PersonaKey = 'normal' | 'asthma' | 'child' | 'elderly' | 'athlete';
type RouteType = string;
type TransitMode = 'walk' | 'cycle' | 'run';
type TimelineView = 'bars' | 'list';
type NavTabId = 'now' | 'timeline' | 'routes' | 'health' | 'alerts';

const NAV_ITEMS: Array<{ id: NavTabId; label: string; href: string; icon: string }> = [
  { id: 'now', label: 'Now', href: '#hero-search-section', icon: 'air' },
  { id: 'timeline', label: 'Timeline', href: '#timeline-section', icon: 'schedule' },
  { id: 'routes', label: 'Routes', href: '#routes-section', icon: 'alt_route' },
  { id: 'health', label: 'Health', href: '#health-workspace-section', icon: 'health_and_safety' },
  { id: 'alerts', label: 'Alerts', href: '#alerts-section', icon: 'notifications_active' },
];

export default function App({ onHome, onSignOut, onProfileConsumed, initialProfileOpen = false }: { onHome?: () => void; onSignOut?: () => Promise<void>; onProfileConsumed?: () => void; initialProfileOpen?: boolean }) {
  const [healthProfileOpen, setHealthProfileOpen] = useState(initialProfileOpen);
  const [accountError, setAccountError] = useState('');
  // Open the profile panel automatically on fresh login.
  useEffect(() => {
    if (initialProfileOpen) setHealthProfileOpen(true);
  }, [initialProfileOpen]);
  const [monitoringExpanded, setMonitoringExpanded] = useState(false);
  const [greetingClock, setGreetingClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setGreetingClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  // Current active location & telemetry
  const [currentLocation, setCurrentLocation] = useState<LocationInfo>(getInitialMonitoringLocation);
  const [stationData, setStationData] = useState<EnvironmentalStationData | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [telemetryReloadKey, setTelemetryReloadKey] = useState(0);
  const locationRevision = useRef(0);
  const telemetryRequestRevision = useRef(0);
  const locationSearchRevision = useRef(0);

  const selectLocation = (location: LocationInfo) => {
    locationRevision.current += 1;
    locationSearchRevision.current += 1;
    try {
      window.sessionStorage.setItem(MONITORING_LOCATION_STORAGE_KEY, JSON.stringify(location));
    } catch {
      // Location selection still works when tab storage is unavailable.
    }
    skipDropdownRef.current = true;
    setSearchQuery([location.name, location.country].filter(Boolean).join(', '));
    setCurrentLocation({ ...location });
    setStationData(null);
    setDiagnosticReport(null);
    setSelectedTimelineHour(null);
    setIsLoading(true);
    setIsLocating(false);
    setIsAnalyzingLocation(false);
    setIsSearching(false);
    setIsDropdownOpen(false);
    setLocationSearchError('');
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState(() => [currentLocation.name, currentLocation.admin1 || currentLocation.country].filter(Boolean).join(', '));
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzingLocation, setIsAnalyzingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // Set to true when a location is selected programmatically so the debounced
  // search effect skips reopening the dropdown for that one update.
  const skipDropdownRef = useRef(true); // true on mount so initial searchQuery value never opens dropdown

  // UI & Navigation state
  const [activeNavTab, setActiveNavTab] = useState<NavTabId>('now');
  const [persona, setPersona] = useState<PersonaKey>('normal');
  const [timelineView, setTimelineView] = useState<TimelineView>('bars');
  const [selectedTimelineHour, setSelectedTimelineHour] = useState<HourlyDataPoint | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteType>('');
  const [routeMode, setRouteMode] = useState<TransitMode>('walk');
  const [routeOrigin, setRouteOrigin] = useState(`${currentLocation.latitude}, ${currentLocation.longitude}`);
  const [routeDestination, setRouteDestination] = useState('');
  const [alertThreshold, setAlertThreshold] = useState<number>(200);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'HI' | 'KN'>('EN');
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(false);
  const [settingsCloudReady, setSettingsCloudReady] = useState(false);
  const [settingsMigrationPending, setSettingsMigrationPending] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState('Loading account settings from DynamoDB…');
  const [scheduledAlertNotice, setScheduledAlertNotice] = useState<string | null>(null);
  const [plannedRoutes, setPlannedRoutes] = useState<PlannedRoute[]>([]);
  const [routeOriginPoint, setRouteOriginPoint] = useState<Coordinates | null>(null);
  const [routeDestinationPoint, setRouteDestinationPoint] = useState<Coordinates | null>(null);
  const [routeError, setRouteError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [routeQualityNote, setRouteQualityNote] = useState('');
  const [trackRouteAqi, setTrackRouteAqi] = useState(false);
  const [aqiRefreshing, setAqiRefreshing] = useState(false);
  const [routeChoices, setRouteChoices] = useState<{ field: 'origin' | 'destination'; results: Array<Coordinates & { name: string }> } | null>(null);
  const routeStateRef = useRef(plannedRoutes);
  routeStateRef.current = plannedRoutes;
  const routeRevision = useRef(0);
  const samplingBusy = useRef(false);
  const suggestedRoute = recommendRoute(plannedRoutes);
  const refreshRouteAqi = async () => {
    if (samplingBusy.current || !routeStateRef.current.length || routeLoading) return;
    samplingBusy.current = true;
    setAqiRefreshing(true);
    const revision = routeRevision.current;
    try {
      const refreshed = await sampleRouteAirQuality(routeStateRef.current);
      if (revision !== routeRevision.current) return;
      setPlannedRoutes(refreshed);
      setActiveRoute(recommendRoute(refreshed)?.id || refreshed[0]?.id || '');
    } finally { samplingBusy.current = false; setAqiRefreshing(false); }
  };
  const refreshRouteRef = useRef(refreshRouteAqi);
  refreshRouteRef.current = refreshRouteAqi;
  useEffect(() => {
    if (!trackRouteAqi) return;
    const timer = window.setInterval(() => { if (!document.hidden) void refreshRouteRef.current(); }, 60000);
    return () => window.clearInterval(timer);
  }, [trackRouteAqi]);

  // Modals
  const [addPlaceModalOpen, setAddPlaceModalOpen] = useState<boolean>(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceLoc, setNewPlaceLoc] = useState('');
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<
    Array<{
      id: string;
      name: string;
      loc: string;
      aqi: number;
      cat: string;
      alertOn: boolean;
      coords?: Coordinates;
    }>
  >([]);

  useEffect(() => {
    let active = true;
    cloudRequest('/settings')
      .then(({ data }) => {
        if (!active) return;
        let legacyPlaces: any[] = [];
        let legacyBrowserAlerts: boolean | null = null;
        let legacyThreshold: string | null = null;
        let hasLegacySettings = false;
        try {
          const storedPlaces = window.localStorage.getItem('airexpo-saved-places');
          if (storedPlaces) { legacyPlaces = JSON.parse(storedPlaces); hasLegacySettings = true; }
          legacyThreshold = window.localStorage.getItem('airexpo-alert-threshold');
          if (legacyThreshold !== null) hasLegacySettings = true;
          const storedBrowserAlerts = window.localStorage.getItem('airexpo-browser-alerts');
          if (storedBrowserAlerts !== null) { legacyBrowserAlerts = storedBrowserAlerts === 'true'; hasLegacySettings = true; }
        } catch { /* Keep the cloud settings usable when legacy browser data cannot be read. */ }
        if (data) {
          if (Number.isFinite(data.alertThreshold) && data.alertThreshold >= 0 && data.alertThreshold <= 500) setAlertThreshold(data.alertThreshold);
          if (['EN', 'HI', 'KN'].includes(data.language)) setSelectedLang(data.language);
          if (Array.isArray(data.savedPlaces)) setSavedPlaces(data.savedPlaces.filter((place: any) => place.coords && Number.isFinite(place.coords.lat) && Number.isFinite(place.coords.lon)));
          setBrowserAlertsEnabled(data.browserAlertsEnabled === true);
        } else {
          if (legacyThreshold !== null && Number.isFinite(Number(legacyThreshold)) && Number(legacyThreshold) >= 0 && Number(legacyThreshold) <= 500) setAlertThreshold(Number(legacyThreshold));
          if (Array.isArray(legacyPlaces)) setSavedPlaces(legacyPlaces.filter((place: any) => place.coords && Number.isFinite(place.coords.lat) && Number.isFinite(place.coords.lon)));
          if (legacyBrowserAlerts !== null) setBrowserAlertsEnabled(legacyBrowserAlerts);
        }
        setSettingsMigrationPending(hasLegacySettings);
        setSettingsCloudReady(true);
        setSettingsStatus(data ? 'Account settings loaded from DynamoDB.' : hasLegacySettings ? 'Copying saved browser settings to DynamoDB…' : 'New account settings will be saved to DynamoDB.');
      })
      .catch((error) => { if (active) setSettingsStatus(error instanceof Error ? `Cloud settings unavailable: ${error.message}` : 'Cloud settings unavailable.'); });
    return () => { active = false; };
    // Load once for the signed-in account before enabling autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsCloudReady) return;
    const timer = window.setTimeout(() => {
      void cloudRequest('/settings', { language: selectedLang, alertThreshold, savedPlaces, browserAlertsEnabled })
        .then(() => {
          setSettingsStatus('Settings and saved places are saved to DynamoDB.');
          if (settingsMigrationPending) {
            try {
              for (const key of ['airexpo-saved-places', 'airexpo-alert-threshold', 'airexpo-browser-alerts']) window.localStorage.removeItem(key);
              setSettingsMigrationPending(false);
            } catch { /* Cloud data is already saved; a leftover browser copy is harmless. */ }
          }
        })
        .catch((error) => setSettingsStatus(error instanceof Error ? `Could not save account settings: ${error.message}` : 'Could not save account settings.'));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [settingsCloudReady, settingsMigrationPending, selectedLang, alertThreshold, savedPlaces, browserAlertsEnabled]);

  // Load telemetry when currentLocation changes
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const locationRequestRevision = locationRevision.current;
    const requestRevision = ++telemetryRequestRevision.current;
    const isCurrentRequest = () => !isCancelled
      && locationRequestRevision === locationRevision.current
      && requestRevision === telemetryRequestRevision.current;
    setIsLoading(true);

    fetchEnvironmentalData(currentLocation, controller.signal)
      .then((data) => {
        if (!isCurrentRequest()) return null;
        if (isCurrentRequest()) {
          setStationData(data);
          setSelectedTimelineHour(data.hourlyTimeline[0] || null);
          setIsLoading(false);
        }
        return fetchAiDiagnostic(data, controller.signal);
      })
      .then((report) => {
        if (isCurrentRequest() && report) {
          setDiagnosticReport(report);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn('Atmospheric fetch warning:', err);
        if (isCurrentRequest()) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [currentLocation, telemetryReloadKey]);

  // Debounced search
  useEffect(() => {
    setIsSearching(false);
    if (skipDropdownRef.current) {
      skipDropdownRef.current = false;
      return;
    }
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    let active = true;
    const searchRevision = locationSearchRevision.current;
    const timer = setTimeout(async () => {
      if (!active || searchRevision !== locationSearchRevision.current) return;
      setIsSearching(true);
      const q = searchQuery.trim();
      let results = await searchLocations(q);
      // Retry with city-only part when a "City, State" query returns nothing.
      if (!results.length && q.includes(',')) {
        const cityPart = q.split(',')[0].trim();
        const fallback = await searchLocations(cityPart);
        if (fallback.length) {
          const contextParts = q.split(',').slice(1).map((s) => s.trim().toLowerCase());
          const scored = fallback.map((r) => {
            const haystack = [r.admin1, r.country].join(' ').toLowerCase();
            const score = contextParts.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
            return { r, score };
          });
          scored.sort((a, b) => b.score - a.score);
          results = scored.map((s) => s.r);
        }
      }
      if (!active || searchRevision !== locationSearchRevision.current) return;
      setSearchResults(results);
      setIsSearching(false);
      if (results.length) setIsDropdownOpen(true);
    }, 800);  // FIXED: Increased from 280ms to 800ms to reduce flicker

    return () => { active = false; clearTimeout(timer); };
  }, [searchQuery]);

  const analyzeLocation = async () => {
    const revision = ++locationSearchRevision.current;
    const query = searchQuery.trim();
    if (query.length < 2) {
      setLocationSearchError('Enter at least two characters to search for a location.');
      return;
    }
    setIsAnalyzingLocation(true);
    setIsSearching(false);
    setLocationSearchError('');
    try {
      let results = await searchLocations(query);
      if (revision !== locationSearchRevision.current) return;

      // Open-Meteo geocoder only matches on city name, not "City, State" format.
      // If the full query returns nothing, retry with just the part before the
      // first comma, then prefer results whose admin1/country matches the remainder.
      if (!results.length && query.includes(',')) {
        const parts = query.split(',').map((s) => s.trim());
        const cityPart = parts[0];
        const contextParts = parts.slice(1).map((s) => s.toLowerCase());
        const fallback = await searchLocations(cityPart);
        if (revision !== locationSearchRevision.current) return;
        if (fallback.length) {
          const scored = fallback.map((r) => {
            const haystack = [r.admin1, r.country].join(' ').toLowerCase();
            const score = contextParts.reduce(
              (n, token) => n + (haystack.includes(token) ? 1 : 0),
              0,
            );
            return { r, score };
          });
          scored.sort((a, b) => b.score - a.score);
          results = scored.map((s) => s.r);
        }
      }

      if (!results.length) {
        setLocationSearchError(`No matching location found for "${query}". Try searching with just the city name.`);
        setIsDropdownOpen(false);
        return;
      }
      const selected = results[0];
      selectLocation(selected);
      skipDropdownRef.current = true;
      setSearchQuery(`${selected.name}, ${selected.country}`);
      setSearchResults(results);
      setIsDropdownOpen(false);
    } catch {
      if (revision === locationSearchRevision.current) setLocationSearchError('Location search is temporarily unavailable. Please try again.');
    } finally {
      if (revision === locationSearchRevision.current) setIsAnalyzingLocation(false);
    }
  };

  // Click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smooth scroll handler for both top panel box and mobile bottom bar
  const handleNavClick = (id: NavTabId, href: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNavTab(id);
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 76;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  };

  // Geolocation trigger
  const triggerGeoLocation = () => {
    if (!navigator.geolocation) {
      alert('Location Access Denied: Defaulting to Rohini Regional Ground Station.');
      return;
    }
    const revision = ++locationSearchRevision.current;
    setIsSearching(false);
    setIsAnalyzingLocation(false);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          const userLoc = await reverseGeocode(coords);
          if (revision !== locationSearchRevision.current) return;
          selectLocation(userLoc);
          skipDropdownRef.current = true;
          setSearchQuery(`${userLoc.name}, ${userLoc.country}`);
        } catch {
          if (revision === locationSearchRevision.current) setIsLocating(false);
        }
      },
      () => {
        if (revision === locationSearchRevision.current) {
          alert('Location Access Denied: Defaulting to Rohini Regional Ground Station. You may search manually.');
          setIsLocating(false);
        }
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    translateDocument(selectedLang);
    
    // Debounce MutationObserver to prevent excessive translateDocument calls
    let debounceTimer: number | undefined;
    const observer = new MutationObserver(() => {
      if (debounceTimer !== undefined) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        translateDocument(selectedLang);
        debounceTimer = undefined;
      }, 500);
    });
    
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    
    return () => {
      observer.disconnect();
      if (debounceTimer !== undefined) {
        window.clearTimeout(debounceTimer);
      }
    };
  }, [selectedLang]);

  // Saved places management
  const confirmAddPlace = async () => {
    if (!newPlaceName.trim()) return;
    setIsAddingPlace(true);
    const query = newPlaceLoc || newPlaceName;
    try {
      const searchRes = await searchLocations(query);
      const first = searchRes[0];
      if (!first) throw new Error(`No matching location found for “${query}”.`);
      const envData = await fetchEnvironmentalData(first);
      setSavedPlaces((prev) => [...prev, {
        id: crypto.randomUUID?.() ?? Date.now().toString(),
        name: newPlaceName.trim(),
        loc: [first.name, first.admin1, first.country].filter(Boolean).join(', '),
        aqi: envData.currentAqi,
        cat: envData.aqiCategory.label,
        alertOn: false,
        coords: { lat: first.latitude, lon: first.longitude },
      }]);
      setNewPlaceName('');
      setNewPlaceLoc('');
      setAddPlaceModalOpen(false);
    } catch (error: any) {
      setRouteError(error?.message || 'Could not verify this place right now.');
    }
    finally { setIsAddingPlace(false); }
  };

  const handleSelectSavedPlace = async (pl: typeof savedPlaces[0]) => {
    if (pl.coords) {
      const loc: LocationInfo = {
        name: pl.name,
        country: pl.loc,
        latitude: pl.coords.lat,
        longitude: pl.coords.lon,
      };
      selectLocation(loc);
      skipDropdownRef.current = true;
      setSearchQuery(`${pl.name}, ${pl.loc}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const results = await searchLocations(pl.loc || pl.name);
      if (results[0]) {
        selectLocation(results[0]);
        skipDropdownRef.current = true;
        setSearchQuery(`${results[0].name}, ${results[0].country}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const togglePlaceAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, alertOn: !p.alertOn } : p))
    );
  };

  const removePlace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const scheduleAlertForHour = (hourLabel: string) => {
    setScheduledAlertNotice(`Reminder selected for ${hourLabel}. This page will not notify you later.`);
    setTimeout(() => setScheduledAlertNotice(null), 5000);
  };

  const tomorrowForecast = stationData?.hourlyTimeline.filter((point) => point.dayLabel === 'Tomorrow') ?? [];
  const tomorrowBestWindow = tomorrowForecast.reduce<HourlyDataPoint | null>(
    (best, point) => !best || point.aqi < best.aqi ? point : best,
    null,
  );

  // Derived telemetry and activity advice
  const currentAqi = stationData?.currentAqi ?? 0;
  const timeBasedGreeting = getTimeBasedGreeting(stationData?.location.timezone ?? currentLocation.timezone, greetingClock);
  const mountainPeriod: DayPeriod = timeBasedGreeting === 'Good morning' ? 'morning' : timeBasedGreeting === 'Good afternoon' ? 'afternoon' : timeBasedGreeting === 'Good evening' ? 'evening' : 'night';
  const pm25Val = stationData?.pollutants.pm2_5?.value;
  const pm10Val = stationData?.pollutants.pm10?.value;
  const no2Val = stationData?.pollutants.no2?.value;
  const weather = stationData?.weather;

  // Persona Prescriptions
  const personaContent = {
    normal: {
      name: 'General',
      badge: !stationData ? 'Waiting for air-quality data' : currentAqi > 100 ? 'Elevated modeled AQI' : 'General activity planning',
      verdict: !stationData ? 'Load an air-quality forecast to plan activity.' : currentAqi > 100 ? 'Consider reducing strenuous outdoor activity.' : 'Use the forecast and your comfort to plan activity.',
      subtext: `Current modeled U.S. AQI is ${currentAqi}; use the hourly forecast and your symptoms to choose an activity level. This is general planning guidance, not a personal medical assessment.`,
      tag1: 'DO NOW',
      tip1: currentAqi > 100 ? 'Reduce time outdoors; use indoor filtration if available.' : 'Check local conditions again before a longer outdoor session.',
      tag2: 'AVOID',
      tip2: currentAqi > 100 ? 'Avoid strenuous outdoor cardio while pollution remains elevated.' : 'Choose a route away from busy roads when practical.',
      tag3: 'PLAN',
      tip3: stationData?.safeWindows[0] ? `Lowest forecast window: ${stationData.safeWindows[0].startTime}–${stationData.safeWindows[0].endTime} (AQI ${stationData.safeWindows[0].averageAqi}).` : 'Check the hourly forecast to find a lower-AQI time.',
    },
    asthma: {
      name: 'Asthma',
      badge: 'Asthma profile',
      verdict: currentAqi > 100 ? 'Consider lower-intensity or indoor activity.' : 'Check forecast conditions and follow your action plan.',
      subtext: `Current modeled U.S. AQI is ${currentAqi}. Follow your clinician-approved asthma action plan and use symptoms to guide activity; this app does not assess bronchospasm risk.`,
      tag1: 'ACTION PLAN',
      tip1: 'Follow your clinician-provided asthma action plan and carry prescribed medication.',
      tag2: 'SHIELD',
      tip2: stationData?.safeWindows[0] ? `Check the lower-AQI forecast window (${stationData.safeWindows[0].startTime}–${stationData.safeWindows[0].endTime}) before planning optional exertion.` : 'Review the hourly forecast before planning outdoor activity.',
      tag3: 'SEAL',
      tip3: 'Use your prescribed action plan if symptoms worsen; seek urgent help for severe breathing symptoms.',
    },
    child: {
      name: 'Child',
      badge: 'Child profile',
      verdict: currentAqi > 100 ? 'Consider shorter, less strenuous outdoor play.' : 'Use the hourly forecast when planning outdoor play.',
      subtext: `Current modeled U.S. AQI is ${currentAqi}. Consider shorter, less strenuous outdoor activity when readings are elevated and follow local health guidance.`,
      tag1: 'DO NOW',
      tip1: 'Consider lower-intensity or indoor activities if outdoor air quality is elevated.',
      tag2: 'HYDRATE',
      tip2: 'Use the selected location’s hourly forecast to compare activity times.',
      tag3: 'LIMIT',
      tip3: stationData?.safeWindows[0] ? `Check the forecast for a lower-AQI period, currently ${stationData.safeWindows[0].startTime}–${stationData.safeWindows[0].endTime}.` : 'Check the hourly forecast for a lower-AQI period.',
    },
    elderly: {
      name: 'Elderly',
      badge: 'Older adult profile',
      verdict: currentAqi > 100 ? 'Consider reducing strenuous outdoor exposure.' : 'Plan activity using the hourly forecast and personal comfort.',
      subtext: `Current modeled U.S. AQI is ${currentAqi}. Reduce strenuous exposure if conditions affect you, and follow advice from your healthcare professional.`,
      tag1: 'MEDICATION',
      tip1: 'Follow your usual clinician-provided health guidance.',
      tag2: 'RESTRICT',
      tip2: 'Choose less busy routes when practical.',
      tag3: 'PLAN',
      tip3: stationData?.safeWindows[0] ? `Review the forecast before going out; the lowest modeled window is ${stationData.safeWindows[0].startTime}–${stationData.safeWindows[0].endTime}.` : 'Review the hourly forecast before going out.',
    },
    athlete: {
      name: 'Athlete',
      badge: 'Athlete profile',
      verdict: currentAqi > 100 ? 'Consider indoor or lower-intensity training.' : 'Compare forecast hours before planning training.',
      subtext: `Current modeled U.S. AQI is ${currentAqi}. Higher-intensity exercise increases breathing rate; use the hourly forecast to compare timing and consider indoor training when AQI is elevated.`,
      tag1: 'ADAPT',
      tip1: 'Higher-effort activity increases breathing rate; consider intensity alongside AQI.',
      tag2: 'TIME WINDOW',
      tip2: stationData?.safeWindows[0] ? `Lowest forecast window: ${stationData.safeWindows[0].startTime}–${stationData.safeWindows[0].endTime} (AQI ${stationData.safeWindows[0].averageAqi}).` : 'Compare hourly AQI before choosing an outdoor training time.',
      tag3: 'RECOVERY',
      tip3: 'Use forecast values as planning estimates, and adjust to symptoms and personal guidance.',
    },
  }[persona];

  const getRouteCoords = async (query: string, field: 'origin' | 'destination'): Promise<Coordinates | null> => {
    const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
      const lat = Number(match[1]), lon = Number(match[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Latitude must be between −90 and 90; longitude between −180 and 180.');
      return { lat, lon };
    }
    const data = await routeRequest(`/api/route-geocode?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
    if (data.results.length > 1) {
      setRouteChoices({ field, results: data.results });
      throw new Error(`Choose the correct ${field} from the matching places below, then find routes again.`);
    }
    const place = data.results[0];
    if (place) {
      if (field === 'origin') { setRouteOriginPoint(place); setRouteOrigin(place.name); }
      else { setRouteDestinationPoint(place); setRouteDestination(place.name); }
    }
    return place || null;
  };

  const planRoutes = async () => {
    routeRevision.current += 1;
    const revision = routeRevision.current;
    setRouteChoices(null); setRouteError(''); setRouteQualityNote(''); setRouteLoading(true); setPlannedRoutes([]);
    try {
      const origin = routeOriginPoint || (routeOrigin.trim() ? await getRouteCoords(routeOrigin, 'origin') : null);
      const destination = routeDestinationPoint || (routeDestination.trim() ? await getRouteCoords(routeDestination, 'destination') : null);
      if (!origin && !destination) throw new Error('Could not find the origin or destination. Enter a place name or latitude, longitude in both fields.');
      if (!origin) throw new Error(`Could not find origin “${routeOrigin}”. Enter a place name or latitude, longitude.`);
      if (!destination) throw new Error(`Could not find destination “${routeDestination}”. Enter a place name or latitude, longitude.`);
      setRouteOriginPoint(origin); setRouteDestinationPoint(destination);
      const data = await routeRequest('/api/routes', { method: 'POST', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, destination, mode: routeMode }) });
      const routes: PlannedRoute[] = data.routes;
      if (!Array.isArray(routes) || !routes.length) throw new Error('No route was found. Try a nearby street or another travel mode.');
      if (revision !== routeRevision.current) return;
      setPlannedRoutes(routes.map((route) => ({ ...route, exposure: null, aqi: null, pm2_5: null, pm10: null, observedAt: null })));
      setActiveRoute(routes[0].id);
      setRouteQualityNote(`${data.source}. Checking modeled air quality along the route…`);
      const sampled = await sampleRouteAirQuality(routes);
      if (revision !== routeRevision.current) return;
      setPlannedRoutes(sampled); setActiveRoute(recommendRoute(sampled)?.id || sampled[0]?.id || '');
      setRouteQualityNote(`${data.source}. ${sampled.length === 1 ? 'Only one route is available for this trip. ' : ''}${sampled.every((r) => r.exposure === null) ? 'Pollution data is unavailable. Distance and time are shown without an exposure comparison.' : 'Exposure is a coarse modeled estimate (average PM2.5 × route duration), not a street-level measurement.'}`);
    } catch (error: any) { if (revision === routeRevision.current) setRouteError(error?.message || 'Could not plan this route.'); }
    finally { if (revision === routeRevision.current) setRouteLoading(false); }
  };

  const locateForRoute = () => {
    if (routeLoading) return;
    if (!navigator.geolocation) { setRouteError('Geolocation is not available in this browser. Enter an origin manually.'); return; }
    setRouteError(''); setIsLocating(true);
    const revision = ++routeRevision.current;
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (revision !== routeRevision.current) return;
      routeRevision.current += 1;
      setPlannedRoutes([]); setRouteChoices(null);
      const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
      setUserCoordinates(coords); setRouteOriginPoint(coords);
      setRouteOrigin(`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
      // Keep exact browser coordinates in the input; a reverse-geocoded label
      // may be unsuitable for routing or resolve to a different point. Route
      // geolocation must not change the dashboard's monitored location.
      setIsLocating(false);
    }, (error) => { if (revision === routeRevision.current) { setRouteError(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Enter an origin manually.' : 'Could not get your location. Enter an origin manually.'); setIsLocating(false); } }, { enableHighAccuracy: true, timeout: 12000 });
  };

  // Circular gauge SVG calculations
  const circumference = 251.2;
  const normalizedAqi = Math.min(Math.max(currentAqi, 0), 500);
  const strokeOffset = circumference - (normalizedAqi / 500) * circumference;

  return (
    <div className="dashboard bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(18,35,46,0.04)] border-b border-surface-container/40">
        <div className="h-16 w-full px-margin-mobile md:px-margin flex items-center justify-between gap-space-md">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-space-sm cursor-pointer shrink-0"
            role="button"
            tabIndex={0}
            aria-label="AirExpo home"
            onClick={() => onHome ? onHome() : window.scrollTo({ top: 0, behavior: 'smooth' })}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onHome?.(); } }}
          >
            <div className="h-8 w-8 border-2 border-white flex items-center justify-center text-white" aria-hidden="true">
              <span className="material-symbols-outlined text-[21px]">air</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface tracking-tight font-semibold hidden sm:inline-block">
              AIREXPO
            </span>
          </div>

          {/* Top Panel Navigation Box (Strictly visible on tablet & desktop, hidden on mobile) matching Image 2 */}
          <nav
            aria-label="Desktop Top Panel Navigation"
            className="hidden lg:flex items-center gap-1 p-1 bg-surface-container-low/90 backdrop-blur-md rounded-2xl shadow-xs border border-surface-container"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeNavTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => handleNavClick(item.id, item.href, e)}
                  className={`px-3 py-1.5 text-xs lg:text-[13px] font-label-md transition-all rounded-xl flex items-center gap-1.5 duration-200 active:scale-95 ${
                    isActive
                      ? 'bg-primary text-on-primary font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/70 font-medium'
                  }`}
                  title={`Navigate to ${item.label}`}
                >
                  <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {/* Language Switcher */}
            <div role="group" aria-label="Language" className="language-switcher inline-flex items-center rounded p-space-xs text-label-caps font-label-caps">
              {(['EN', 'HI', 'KN'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  type="button"
                  aria-pressed={selectedLang === lang}
                  className={`lang-pill px-space-xs py-space-xs rounded transition-all ${
                    selectedLang === lang
                      ? 'bg-surface-container-lowest text-on-surface shadow-[0_1px_4px_rgba(18,35,46,0.06)] font-semibold'
                      : 'hover:text-on-surface text-on-surface-variant'
                  }`}
                >
                  {lang === 'EN' ? 'EN' : lang === 'HI' ? 'हिं' : 'ಕನ್ನಡ'}
                </button>
              ))}
            </div>
            <button onClick={()=>setHealthProfileOpen(true)} aria-label="Profile" title="Profile" className="border border-white/40 text-white p-2 inline-flex items-center justify-center"><UserRound className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {healthProfileOpen && <React.Suspense fallback={null}><UserHealthProfile onClose={() => { setHealthProfileOpen(false); onProfileConsumed?.(); }} onSignOut={onSignOut} /></React.Suspense>}
      {accountError && <p role="alert" className="fixed top-16 right-4 z-50 bg-white border border-primary p-3">{accountError}</p>}
      {/* MAIN CONTAINER */}
      <main className="w-full pt-16 pb-24 lg:pb-10 bg-background flex-1">
        <div className="flex flex-col w-full">
          {/* Scheduled Alert Notice Toast */}
          {scheduledAlertNotice && (
            <div className="w-full bg-secondary text-on-secondary px-margin py-space-xs flex items-center justify-between text-label-md transition-all sticky top-16 z-40 shadow-md">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[18px]">alarm_on</span>
                <span>{scheduledAlertNotice}</span>
              </div>
              <button
                className="text-on-secondary hover:opacity-80 active:scale-90 transition-transform"
                onClick={() => setScheduledAlertNotice(null)}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}
          {/* LIVE LOCATION & PROFILE — kept at the top for immediate context */}
          <section className="w-full px-margin-mobile md:px-margin pt-space-lg pb-space-md">
            <div className="monitoring-card relative isolate overflow-hidden rounded-[22px] border border-[#e6dfd4] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(16,22,47,0.08)] md:px-7 md:py-6">
              <MountainBackdrop period={mountainPeriod} />
              <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" aria-hidden="true" />
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#111831] text-primary shadow-inner sm:h-14 sm:w-14">
                    <span className="text-[30px] leading-none sm:text-[34px]" aria-hidden="true">
                      {timeBasedGreeting === 'Good morning' || timeBasedGreeting === 'Good afternoon'
                        ? '☀️'
                        : timeBasedGreeting === 'Good evening' ? '🌇' : '🌙'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Current monitoring location</div>
                    <h2 className="font-headline-lg text-3xl font-bold leading-tight tracking-tight text-[#111831] sm:text-4xl">{timeBasedGreeting},</h2>
                    <p className="mt-1 truncate text-sm font-medium text-on-surface-variant sm:text-base">{currentLocation.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-on-surface-variant sm:text-sm">
                      {(currentLocation.admin1 || currentLocation.country) && <span>{[currentLocation.admin1, currentLocation.country].filter(Boolean).join(', ')}</span>}
                      <span className="font-mono tabular-nums text-[11px] text-[#687386]">{currentLocation.latitude.toFixed(2)}°, {currentLocation.longitude.toFixed(2)}°</span>
                    </div>
                  </div>
                </div>
                <div aria-live="polite" className={`flex shrink-0 items-center gap-3 self-start rounded-2xl border px-4 py-3 sm:self-center ${stationData ? 'border-emerald-200 bg-emerald-50/80' : isLoading ? 'border-amber-200 bg-amber-50/80' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`relative flex h-2.5 w-2.5 shrink-0 rounded-full ${stationData ? 'bg-emerald-500' : isLoading ? 'bg-amber-500' : 'bg-slate-400'}`}>
                    {stationData && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />}
                  </span>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.16em] ${stationData ? 'text-emerald-800' : isLoading ? 'text-amber-800' : 'text-slate-600'}`}>
                      {stationData ? 'Modeled feed active' : isLoading ? 'Updating forecast' : 'Forecast unavailable'}
                    </div>
                    <div className="mt-0.5 text-xs font-medium tabular-nums text-slate-600">
                      {stationData ? `Updated ${stationData.lastUpdated}` : isLoading ? 'Retrieving location data…' : 'Try refreshing or another location'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="monitoring-actions">
                <button type="button" onClick={() => { document.getElementById('hero-search-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.querySelector<HTMLInputElement>('#hero-search-section input')?.focus({ preventScroll: true }); }}><span className="material-symbols-outlined">search</span>Change location</button>
                <button type="button" onClick={triggerGeoLocation} disabled={isLocating}><span className="material-symbols-outlined">near_me</span>{isLocating ? 'Locating…' : 'Use my location'}</button>
                <button type="button" onClick={() => setTelemetryReloadKey((key) => key + 1)} disabled={isLoading}><span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>{isLoading ? 'Refreshing…' : 'Refresh readings'}</button>
                <button type="button" className="monitoring-details-toggle" aria-expanded={monitoringExpanded} aria-controls="monitoring-details" onClick={() => setMonitoringExpanded((expanded) => !expanded)}>{monitoringExpanded ? 'Less detail' : 'Your air at a glance'}<span className="material-symbols-outlined">{monitoringExpanded ? 'expand_less' : 'expand_more'}</span></button>
              </div>
              {monitoringExpanded && <div className="monitoring-details" id="monitoring-details">
                <div><span>Current U.S. AQI</span><strong>{stationData?.currentAqi ?? '—'}</strong><small>{stationData?.aqiCategory.label ?? 'Waiting for conditions'}</small></div>
                <div><span>Temperature</span><strong>{stationData?.weather.temperature == null ? '—' : `${stationData.weather.temperature}°C`}</strong><small>{stationData?.weather.weatherDescription ?? 'Weather unavailable'}</small></div>
                <div><span>Fine particles · PM2.5</span><strong>{stationData?.pollutants.pm2_5?.value ?? '—'}<small> µg/m³</small></strong><small>Open-Meteo modeled estimate</small></div>
                <button type="button" onClick={() => document.getElementById('timeline-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Explore hourly forecast<span className="material-symbols-outlined">arrow_forward</span></button>
              </div>}
            </div>
          </section>

          {/* SECTION 1: SEARCH & DISCOVERY PORTAL */}
          <section
            className="w-full px-margin-mobile md:px-margin pt-space-xl pb-space-lg flex flex-col items-center text-center relative overflow-hidden"
            id="hero-search-section"
          >
            <React.Suspense fallback={null}><AqiGlobe /></React.Suspense>
            {/* Ambient Aura & Drifting Particles */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[760px] max-w-full h-[360px] bg-gradient-to-b from-primary-fixed/30 via-surface-container-low/40 to-transparent blur-3xl pointer-events-none -z-10"></div>
            <div className="absolute top-10 left-1/4 w-32 h-32 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none particle-drift-1 -z-10"></div>
            <div className="absolute top-20 right-1/4 w-40 h-40 rounded-full bg-primary-fixed/25 blur-2xl pointer-events-none particle-drift-2 -z-10"></div>
            <div className="absolute top-44 left-1/3 w-28 h-28 rounded-full bg-tertiary-fixed/20 blur-2xl pointer-events-none particle-drift-3 -z-10"></div>

            <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded bg-secondary text-on-secondary text-label-caps font-label-caps tracking-widest uppercase mb-space-sm shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              Precision Atmospheric Health Engine
            </div>

            <h1 className="font-display-hero text-display-hero-mobile md:text-display-hero text-on-surface max-w-3xl leading-tight mb-space-xs transition-colors">
              Know when to <span className="text-secondary">/breathe easier.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-space-lg">
              Air quality, micro-weather, and hyper-personalized bio-advice — calibrated into one distinct human decision.
            </p>

            {/* Search Bar with Genuine Geocoding */}
            <div
              className="w-full max-w-2xl bg-surface-container-lowest p-space-xs rounded-2xl shadow-xl flex flex-col sm:flex-row sm:flex-wrap items-center gap-space-xs relative z-40 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-2xl"
              ref={searchContainerRef}
            >
              <div className="flex items-center flex-1 w-full px-space-md py-space-xs gap-space-sm">
                <span className="material-symbols-outlined text-outline">search</span>
                <input
                  className="w-full bg-transparent border-0 outline-none text-on-surface font-body-md text-body-md placeholder:text-outline"
                  placeholder="Search city, neighborhood, or postal station..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    locationSearchRevision.current += 1;
                    skipDropdownRef.current = false;
                    setIsAnalyzingLocation(false);
                    setIsLocating(false);
                    setSearchQuery(e.target.value);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setIsDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void analyzeLocation();
                  }}
                />
                {searchQuery && (
                  <button
                    className="text-outline-variant hover:text-on-surface transition-colors active:scale-90"
                    onClick={() => setSearchQuery('')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-space-xs w-full sm:w-auto px-space-xs sm:px-0">
                <button
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-space-xs px-space-md py-space-sm bg-surface-container-low text-primary hover:bg-surface-container rounded-xl text-label-md font-label-md transition-all active:scale-95"
                  onClick={triggerGeoLocation}
                  disabled={isLocating}
                  title="Detect Current Station"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isLocating ? 'refresh' : 'near_me'}
                  </span>
                  <span className="hidden sm:inline">
                    {isLocating ? 'Locating...' : 'Use my location'}
                  </span>
                  <span className="sm:hidden">{isLocating ? '...' : 'Current'}</span>
                </button>

                <button
                  className="flex items-center justify-center px-space-lg py-space-sm bg-primary-container text-on-primary hover:bg-primary rounded-xl text-label-md font-label-md shadow-md transition-all active:scale-95"
                  onClick={() => void analyzeLocation()}
                  disabled={isAnalyzingLocation || searchQuery.trim().length < 2}
                  type="button"
                >
                  {isAnalyzingLocation ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && searchResults.length > 0 && (
                <div className="w-full basis-full mt-2 bg-surface-container-lowest border border-surface-container rounded-2xl shadow-2xl max-h-64 overflow-y-auto z-50 divide-y divide-surface-container">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        skipDropdownRef.current = true;
                        selectLocation(res);
                        setSearchQuery(`${res.name}, ${res.country}`);
                        setSearchResults([]);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-space-md py-space-sm hover:bg-surface-container-low transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-on-surface font-title-md">{res.name}</div>
                        <div className="text-[11px] text-on-surface-variant font-body-sm">
                          {[res.admin1, res.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-label-caps tabular-nums">
                        {res.latitude.toFixed(2)}°, {res.longitude.toFixed(2)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {locationSearchError && (
              <div role="alert" className="mt-3 w-full max-w-2xl bg-error-container text-on-error-container border border-error px-4 py-2 text-sm text-left">
                {locationSearchError}
              </div>
            )}

            {/* Quick Location Chips */}
            <div className={`flex flex-wrap items-center justify-center gap-space-sm mt-space-md transition-opacity ${
              isDropdownOpen && searchResults.length > 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Quick telemetry:
              </span>
              <button
                className="px-space-md py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all text-label-md font-label-md flex items-center gap-1.5 active:scale-95 hover:-translate-y-0.5"
                onClick={() => {
                  const del = { name: 'Rohini, Delhi', country: 'India', latitude: 28.7041, longitude: 77.1025 };
                  selectLocation(del);
                  setSearchQuery('Rohini, Delhi');
                }}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-tertiary"></span> Delhi (238 AQI)
              </button>
              <button
                className="px-space-md py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all text-label-md font-label-md flex items-center gap-1.5 active:scale-95 hover:-translate-y-0.5"
                onClick={() => {
                  const ben = { name: 'Bengaluru', country: 'India', latitude: 12.9716, longitude: 77.5946 };
                  selectLocation(ben);
                  setSearchQuery('Bengaluru, India');
                }}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-secondary"></span> Bengaluru (54 AQI)
              </button>
              <button
                className="px-space-md py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all text-label-md font-label-md flex items-center gap-1.5 active:scale-95 hover:-translate-y-0.5"
                onClick={() => {
                  const mum = { name: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.8777 };
                  selectLocation(mum);
                  setSearchQuery('Mumbai, India');
                }}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-primary"></span> Mumbai (118 AQI)
              </button>
            </div>
          </section>

          {/* SECTION 2: ASYMMETRICAL DECISION DASHBOARD */}
          <OpenMeteoLivePanel
            timestamp={greetingClock}
            location={currentLocation}
            data={stationData}
            loading={isLoading}
            personaName={personaContent.name}
            onRefresh={() => setTelemetryReloadKey((value) => value + 1)}
          />

          {stationData && <React.Suspense fallback={null}><ComparisonMatrix currentStation={stationData} onSelectLocation={selectLocation} /></React.Suspense>}

          <section id="routes-section" className="w-full px-margin-mobile md:px-margin pb-space-xl">
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm flex flex-col gap-space-lg">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><span className="font-label-caps uppercase">Respiratory route navigation</span><h2 className="font-headline-lg text-headline-lg">Take the Cleaner Way</h2><p className="text-sm">Plan your trip, compare current modeled AQI and select a route on the map.</p></div><div className="flex gap-2">{(['walk','cycle','run'] as const).map(mode => <button key={mode} disabled={routeLoading} onClick={() => { routeRevision.current++; setRouteMode(mode); setPlannedRoutes([]); }} className={`px-4 py-2 border border-primary capitalize ${routeMode === mode ? 'bg-secondary' : ''}`}>{mode}</button>)}</div></div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <button onClick={locateForRoute} disabled={isLocating || routeLoading} className="bg-primary text-white p-3">{isLocating ? 'Getting location…' : 'Use my current location'}</button>
                  <label className="text-xs uppercase">Origin<input aria-label="Route origin" disabled={routeLoading} value={routeOrigin} onChange={e => { routeRevision.current++; setRouteOrigin(e.target.value); setRouteOriginPoint(null); setPlannedRoutes([]); setRouteChoices(null); }} className="block w-full border border-primary p-3 mt-1 text-sm" /></label>
                  <button disabled={routeLoading} className="text-xs self-end underline" onClick={() => { routeRevision.current++; setRouteOrigin(routeDestination); setRouteDestination(routeOrigin); setRouteOriginPoint(routeDestinationPoint); setRouteDestinationPoint(routeOriginPoint); setPlannedRoutes([]); }}>Swap</button>
                  <label className="text-xs uppercase">Destination<input aria-label="Route destination" placeholder="Place name or latitude, longitude" disabled={routeLoading} value={routeDestination} onChange={e => { routeRevision.current++; setRouteDestination(e.target.value); setRouteDestinationPoint(null); setPlannedRoutes([]); setRouteChoices(null); }} className="block w-full border border-primary p-3 mt-1 text-sm" /></label>
                  <button onClick={planRoutes} disabled={routeLoading} className="bg-primary text-white p-3 font-semibold">{routeLoading ? 'Finding routes and sampling air quality…' : 'Find routes'}</button>
                  {routeError && <p role="alert" className="text-red-800 text-sm">{routeError}</p>}
                  {routeChoices && <div className="border border-primary p-3"><strong>Select {routeChoices.field}</strong>{routeChoices.results.map((place,i) => <button key={i} className="block text-left text-sm border-t py-3 w-full" onClick={() => { if(routeChoices.field === 'origin') {setRouteOriginPoint(place);setRouteOrigin(place.name);} else {setRouteDestinationPoint(place);setRouteDestination(place.name);}setRouteChoices(null);setRouteError(''); }}>{place.name}</button>)}</div>}
                  <p className="text-xs text-on-surface-variant">Click the map to set your destination. AQI samples use a modeled grid, not street sensors.</p>
                </div>
                <React.Suspense fallback={<div className="min-h-64 rounded-xl bg-surface-container-low animate-pulse" aria-label="Loading route map" />}><GoogleJoggingMap center={{lat:currentLocation.latitude,lon:currentLocation.longitude}} origin={routeOriginPoint} destination={routeDestinationPoint} routes={plannedRoutes} selectedRoute={activeRoute} onSelectRoute={setActiveRoute} userLocation={userCoordinates} onMapPick={point => {if(routeLoading)return;routeRevision.current++;setPlannedRoutes([]);setRouteDestinationPoint(point);setRouteDestination(`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);}} /></React.Suspense>
              </div>
              {plannedRoutes.length > 0 && <div className="border-2 border-primary p-4 space-y-3" aria-live="polite"><div className="flex justify-between gap-3"><strong>Current AQI route check</strong><button disabled={aqiRefreshing || routeLoading} onClick={() => void refreshRouteAqi()} className="underline text-sm">{aqiRefreshing ? 'Checking…' : 'Refresh AQI'}</button></div><label className="flex gap-2 text-xs"><input type="checkbox" checked={trackRouteAqi} onChange={e=>setTrackRouteAqi(e.target.checked)} />Check AQI every minute while this page is visible</label><p className="text-sm">{routeLoading ? 'Checking current AQI…' : !suggestedRoute ? 'Complete recent AQI samples unavailable. No clean-air recommendation can be made.' : isGoodRoute(suggestedRoute) ? `Route ${plannedRoutes.indexOf(suggestedRoute)+1}: every sampled point is in the Good range (AQI ≤50).` : `No route has all samples in the Good range. Route ${plannedRoutes.indexOf(suggestedRoute)+1} has the lowest peak AQI (${Math.round(suggestedRoute.maxAqi!)}), but is not a healthy-air route. Consider waiting or moving activity indoors.`}</p>{suggestedRoute?.checkedAt && <p className="text-xs">Last checked: {new Date(suggestedRoute.checkedAt).toLocaleTimeString()} · Model time: {suggestedRoute.observedAt ? new Date(suggestedRoute.observedAt).toLocaleString() : 'unavailable'}</p>}<p className="text-xs">Current modeled estimates; unsampled streets may differ. Checking more often does not update the underlying model more often.</p></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">{plannedRoutes.map((route,i)=><button key={route.id} onClick={()=>setActiveRoute(route.id)} className={`text-left p-4 border-2 flex flex-col gap-2 ${activeRoute === route.id ? 'border-primary bg-secondary-container shadow-md' : 'border-surface-container bg-surface-container-low'}`}><div className="flex justify-between gap-3"><strong>Route {i+1}{suggestedRoute?.id===route.id ? ' · Recommended comparison' : ''}</strong><strong>{Math.round(route.durationMin)} min</strong></div><p className="text-sm">{route.distanceKm.toFixed(1)} km · Average AQI {route.aqi === null ? 'unavailable' : Math.round(route.aqi)}</p><p className="text-xs">Peak AQI: {route.maxAqi ?? 'unavailable'} · {isGoodRoute(route) ? 'All samples Good' : route.validSamples !== route.sampleCount ? 'Incomplete samples' : 'Above Good range'} · {route.validSamples ?? 0}/{route.sampleCount ?? 0} points</p><p className="text-xs">PM2.5: {route.pm2_5?.toFixed(1) ?? 'unavailable'} µg/m³ · Exposure score: {route.exposure === null ? 'unavailable' : Math.round(route.exposure)}</p></button>)}</div>
              {routeQualityNote && <details className="text-xs text-on-surface-variant"><summary className="cursor-pointer">Data source and estimation details</summary><p className="mt-2">{routeQualityNote}</p></details>}
            </div>
          </section>

          {/* SECTION 5: SAVED PLACES & AIR ALERTS */}
          <section
            className="w-full px-margin-mobile md:px-margin pb-space-xl grid grid-cols-1 lg:grid-cols-12 gap-space-lg"
            id="places-section"
          >
            {/* Saved Places List */}
            <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-space-md">
                  <div>
                    <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider block">
                      Multi-Location Monitoring
                    </span>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Saved Micro-Zones
                    </h3>
                  </div>
                  <button
                    onClick={() => setAddPlaceModalOpen(true)}
                    className="flex items-center gap-1.5 px-space-md py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md transition-all font-semibold active:scale-95 shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                    <span>+ Add place</span>
                  </button>
                </div>

                {/* Places Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                  {savedPlaces.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => handleSelectSavedPlace(pl)}
                      className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between cursor-pointer relative group"
                    >
                      <div className="flex items-start justify-between">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          location_on
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-label-caps bg-primary-fixed text-on-primary-fixed font-bold uppercase">
                            {pl.cat}
                          </span>
                          <button
                            onClick={(e) => removePlace(pl.id, e)}
                            className="text-on-surface-variant hover:text-error opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2"
                            title="Remove place"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      </div>
                      <div className="my-space-sm">
                        <div className="font-title-md text-title-md text-on-surface font-semibold">{pl.name}</div>
                        <span className="text-body-sm font-body-sm text-on-surface-variant block">{pl.loc}</span>
                      </div>
                      <div className="flex items-center justify-between pt-space-xs border-0 border-surface-container">
                        <span className="font-headline-md text-headline-md font-bold text-on-surface tabular-nums">
                          {pl.aqi}
                        </span>
                        <button
                          onClick={(e) => togglePlaceAlert(pl.id, e)}
                          className={`text-label-caps font-label-caps font-semibold flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded ${
                            pl.alertOn ? 'text-secondary hover:bg-secondary-container/40' : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {pl.alertOn ? 'notifications_active' : 'notifications_off'}
                          </span>
                          {pl.alertOn ? 'Alert ON' : 'Alert OFF'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-space-md pt-space-md flex items-center justify-between text-label-md text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">cloud_sync</span>
                  Saved locations stay in this page session.
                </span>
                <button onClick={() => setHealthProfileOpen(true)} className="text-primary hover:underline font-semibold">
                  Manage all places
                </button>
              </div>
            </div>

            {/* Air Alerts Config Panel */}
            <div className="lg:col-span-5 space-y-2">
              <React.Suspense fallback={<div className="min-h-80 rounded-xl bg-surface-container-low animate-pulse" aria-label="Loading air alerts" />}><AirAlerts aqi={stationData?.currentAqi ?? null} threshold={alertThreshold} setThreshold={setAlertThreshold} location={currentLocation} browserAlertsEnabled={browserAlertsEnabled} onBrowserAlertsChange={setBrowserAlertsEnabled} /></React.Suspense>
              {settingsStatus && <p role="status" className="text-xs text-on-surface-variant">{settingsStatus}</p>}
            </div>

          </section>

          <React.Suspense fallback={<div className="min-h-96 rounded-xl bg-surface-container-low animate-pulse" aria-label="Loading health workspace" />}><HealthWorkspace
            stationData={stationData}
            onModeChange={(mode) => setPersona(mode === 'asthma' ? 'asthma' : mode === 'athlete' ? 'athlete' : 'normal')}
          /></React.Suspense>



          {/* ADD PLACE MODAL */}
          {addPlaceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm p-margin-mobile">
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-md max-h-[85dvh] overflow-y-auto shadow-2xl flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Add Monitored Place</h3>
                  <button onClick={() => setAddPlaceModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-space-sm">
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                      Place Name
                    </label>
                    <input
                      className="w-full p-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md outline-none focus:ring-2 focus:ring-primary shadow-inner"
                      placeholder="e.g. Grandma's Residence, Office..."
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                      Location or Postal Area
                    </label>
                    <input
                      className="w-full p-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md outline-none focus:ring-2 focus:ring-primary shadow-inner"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={newPlaceLoc}
                      onChange={(e) => setNewPlaceLoc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                  <button
                    onClick={() => setAddPlaceModalOpen(false)}
                    className="px-space-md py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAddPlace}
                    disabled={isAddingPlace}
                    className="px-space-lg py-2 rounded-lg bg-primary text-on-primary text-label-md font-label-md hover:bg-primary-container shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    {isAddingPlace ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                        <span>Verifying Station...</span>
                      </>
                    ) : (
                      <span>Add Place</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}


        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (Strictly visible ONLY on mobile web app: flex md:hidden) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="dashboard-bottom-nav flex lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(18,35,46,0.08)] h-16 px-1 items-center justify-around border-t border-surface-container"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeNavTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => handleNavClick(item.id, item.href, e)}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 relative ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title={`Jump to ${item.label}`}
            >
              {isActive && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-primary transition-all"></span>
              )}
              <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'text-primary scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10.5px] font-label-caps tracking-tight ${isActive ? 'text-primary font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* FOOTER */}
      <footer className="hidden md:block w-full bg-surface-container-low mt-auto py-space-lg">
        <div className="w-full px-margin flex flex-col sm:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              © 2026 AirExpo
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              Atmospheric Bio-Telemetry · Open-Meteo/CAMS
            </span>
          </div>
          <div className="flex items-center gap-space-lg text-label-md font-label-md text-on-surface-variant">
            <a className="hover:text-on-surface transition-colors" href="#satellite-section">
              Satellite Optics
            </a>
            <a className="hover:text-on-surface transition-colors" href="#timeline-section">
              Diurnal Modeling
            </a>
            <a className="hover:text-on-surface transition-colors" href="#routes-section">
              Clean Corridors
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
