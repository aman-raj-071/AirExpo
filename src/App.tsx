import React, { useState, useEffect, useRef } from 'react';
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
import { SatelliteViewer } from './components/SatelliteViewer';
import { HealthWorkspace } from './components/HealthWorkspace';
import { GoogleJoggingMap } from './components/GoogleJoggingMap';
import { OpenMeteoLivePanel } from './components/OpenMeteoLivePanel';
import { translateDocument } from './services/i18n';

// Default initial location: Rohini, Delhi
const INITIAL_LOCATION: LocationInfo = {
  name: 'Rohini, Delhi',
  country: 'India',
  admin1: 'Delhi',
  latitude: 28.7041,
  longitude: 77.1025,
};

type PersonaKey = 'normal' | 'asthma' | 'child' | 'elderly' | 'athlete';
type RouteType = 'clean' | 'fast';
type TransitMode = 'walk' | 'cycle' | 'run';
type TimelineView = 'bars' | 'list';
type NavTabId = 'now' | 'satellite' | 'timeline' | 'routes' | 'places' | 'alerts';

const NAV_ITEMS: Array<{ id: NavTabId; label: string; href: string; icon: string }> = [
  { id: 'now', label: 'Now', href: '#hero-search-section', icon: 'air' },
  { id: 'satellite', label: 'Satellite', href: '#satellite-section', icon: 'satellite_alt' },
  { id: 'timeline', label: 'Timeline', href: '#timeline-section', icon: 'schedule' },
  { id: 'routes', label: 'Routes', href: '#routes-section', icon: 'alt_route' },
  { id: 'places', label: 'Places', href: '#places-section', icon: 'pin_drop' },
  { id: 'alerts', label: 'Alerts', href: '#alerts-section', icon: 'notifications_active' },
];

export default function App() {
  // Current active location & telemetry
  const [currentLocation, setCurrentLocation] = useState<LocationInfo>(INITIAL_LOCATION);
  const [stationData, setStationData] = useState<EnvironmentalStationData | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [telemetryReloadKey, setTelemetryReloadKey] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('Rohini, Delhi');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzingLocation, setIsAnalyzingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // UI & Navigation state
  const [activeNavTab, setActiveNavTab] = useState<NavTabId>('now');
  const [persona, setPersona] = useState<PersonaKey>('normal');
  const [timelineView, setTimelineView] = useState<TimelineView>('bars');
  const [selectedTimelineHour, setSelectedTimelineHour] = useState<HourlyDataPoint | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteType>('clean');
  const [routeMode, setRouteMode] = useState<TransitMode>('walk');
  const [routeOrigin, setRouteOrigin] = useState('Home · Rohini Sector 16');
  const [routeDestination, setRouteDestination] = useState('College · University Campus');
  const [alertThreshold, setAlertThreshold] = useState<number>(200);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'HI' | 'KN'>('EN');
  const [offlineNotice, setOfflineNotice] = useState<boolean>(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState<boolean>(false);
  const [userAuthEmail, setUserAuthEmail] = useState<string | null>(null);
  const [scheduledAlertNotice, setScheduledAlertNotice] = useState<string | null>(null);

  // Modals
  const [addPlaceModalOpen, setAddPlaceModalOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInputEmail, setAuthInputEmail] = useState('');
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
  >([
    { id: '1', name: 'Home', loc: 'Rohini, Sec 16', aqi: 238, cat: 'Poor', alertOn: true, coords: { lat: 28.7041, lon: 77.1025 } },
    { id: '2', name: 'College', loc: 'North Campus', aqi: 142, cat: 'Moderate', alertOn: false, coords: { lat: 28.6892, lon: 77.2104 } },
    { id: '3', name: 'Sports Complex', loc: 'Pacific Enclave', aqi: 78, cat: 'Satisfactory', alertOn: true, coords: { lat: 28.6448, lon: 77.1072 } },
  ]);

  // Load telemetry when currentLocation changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setStationData(null);

    fetchEnvironmentalData(currentLocation)
      .then((data) => {
        if (!isCancelled) {
          setStationData(data);
          setSelectedTimelineHour(data.hourlyTimeline[0] || null);
          setIsLoading(false);
        }
        return fetchAiDiagnostic(data);
      })
      .then((report) => {
        if (!isCancelled && report) {
          setDiagnosticReport(report);
        }
      })
      .catch((err) => {
        console.warn('Atmospheric fetch warning:', err);
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentLocation, telemetryReloadKey]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setIsDropdownOpen(true);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const analyzeLocation = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setLocationSearchError('Enter at least two characters to search for a location.');
      return;
    }
    setIsAnalyzingLocation(true);
    setLocationSearchError('');
    try {
      const results = await searchLocations(query);
      if (!results.length) {
        setLocationSearchError(`No matching location found for “${query}”. Try adding the state or country.`);
        setIsDropdownOpen(false);
        return;
      }
      const selected = results[0];
      setCurrentLocation(selected);
      setSearchQuery(`${selected.name}, ${selected.country}`);
      setSearchResults(results);
      setIsDropdownOpen(false);
    } catch {
      setLocationSearchError('Location search is temporarily unavailable. Please try again.');
    } finally {
      setIsAnalyzingLocation(false);
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

  // Scroll spy to sync activeNavTab with viewport section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      const sections: Array<{ id: NavTabId; el: HTMLElement | null }> = [
        { id: 'alerts', el: document.getElementById('alerts-section') },
        { id: 'places', el: document.getElementById('places-section') },
        { id: 'routes', el: document.getElementById('routes-section') },
        { id: 'timeline', el: document.getElementById('timeline-section') },
        { id: 'satellite', el: document.getElementById('satellite-section') },
        { id: 'now', el: document.getElementById('hero-search-section') },
      ];

      for (const sec of sections) {
        if (sec.el) {
          const elTop = sec.el.getBoundingClientRect().top + window.scrollY;
          if (elTop <= scrollPos) {
            setActiveNavTab(sec.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Geolocation trigger
  const triggerGeoLocation = () => {
    if (!navigator.geolocation) {
      alert('Location Access Denied: Defaulting to Rohini Regional Ground Station.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const userLoc = await reverseGeocode(coords);
        setCurrentLocation(userLoc);
        setSearchQuery(`${userLoc.name}, ${userLoc.country}`);
        setIsLocating(false);
      },
      () => {
        alert('Location Access Denied: Defaulting to Rohini Regional Ground Station. You may search manually.');
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    translateDocument(selectedLang);
    const observer = new MutationObserver(() => translateDocument(selectedLang));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [selectedLang]);

  // Saved places management
  const confirmAddPlace = async () => {
    if (!newPlaceName) return;
    setIsAddingPlace(true);
    const query = newPlaceLoc || newPlaceName;
    let detectedAqi = 85;
    let detectedCat = 'Moderate';
    let placeCoords: Coordinates | undefined = undefined;

    try {
      const searchRes = await searchLocations(query);
      if (searchRes.length > 0) {
        const first = searchRes[0];
        placeCoords = { lat: first.latitude, lon: first.longitude };
        const envData = await fetchEnvironmentalData(first);
        detectedAqi = envData.currentAqi;
        detectedCat = envData.aqiCategory.label;
      }
    } catch (_e) {
      // fallback
    }

    setSavedPlaces((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newPlaceName,
        loc: newPlaceLoc || 'Monitored Zone',
        aqi: detectedAqi,
        cat: detectedCat,
        alertOn: true,
        coords: placeCoords,
      },
    ]);
    setNewPlaceName('');
    setNewPlaceLoc('');
    setIsAddingPlace(false);
    setAddPlaceModalOpen(false);
  };

  const handleSelectSavedPlace = async (pl: typeof savedPlaces[0]) => {
    if (pl.coords) {
      const loc: LocationInfo = {
        name: pl.name,
        country: pl.loc,
        latitude: pl.coords.lat,
        longitude: pl.coords.lon,
      };
      setCurrentLocation(loc);
      setSearchQuery(`${pl.name}, ${pl.loc}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const results = await searchLocations(pl.loc || pl.name);
      if (results[0]) {
        setCurrentLocation(results[0]);
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
    setScheduledAlertNotice(`✓ Exposure Guardian Scheduled for ${hourLabel}. You will be alerted 15 minutes prior.`);
    setTimeout(() => setScheduledAlertNotice(null), 5000);
  };

  // Persona Prescriptions
  const personaContent = {
    normal: {
      name: 'General',
      badge: stationData?.currentAqi && stationData.currentAqi > 200 ? '▲ Poor Air Quality' : '● General Respiratory',
      verdict: stationData?.currentAqi && stationData.currentAqi > 200 ? 'Limit strenuous outdoor time.' : 'Normal outdoor activity permitted.',
      subtext: 'Air is saturated with particulates. Sensitive respiratory systems will experience irritation within 35 minutes of unshielded exertion.',
      tag1: 'DO NOW',
      tip1: 'Keep indoor HEPA air filtration running on medium cycle.',
      tag2: 'AVOID',
      tip2: 'Avoid vigorous outdoor cardio or cycling along primary transit arteries.',
      tag3: 'PLAN',
      tip3: 'Optimal outdoor window opens between 6:30 PM and 8:00 PM tonight.',
    },
    asthma: {
      name: 'Asthma',
      badge: '▲ High Trigger Risk',
      verdict: 'Stay strictly indoors. High bronchospasm risk.',
      subtext: 'Elevated PM2.5 and boundary inversion trap heavy particulate matter at lung level. Wear an N95 respirator if you must step outside.',
      tag1: 'CRITICAL',
      tip1: 'Carry fast-acting bronchodilator rescue inhaler at all times today.',
      tag2: 'SHIELD',
      tip2: 'Strictly avoid evening open-air exposure before 6:30 PM.',
      tag3: 'SEAL',
      tip3: 'Ensure room windows remain completely shut with HEPA purifier active.',
    },
    child: {
      name: 'Child',
      badge: '▲ Developing Lungs Alert',
      verdict: 'Restrict playground activities and school outdoor sports.',
      subtext: 'Children have higher ventilation rates per kilogram of body weight and inhale proportionally more particulates during playground sports.',
      tag1: 'DO NOW',
      tip1: 'Transition school and evening sports activities indoors.',
      tag2: 'HYDRATE',
      tip2: 'Keep hydration elevated to support mucosal particulate clearance.',
      tag3: 'LIMIT',
      tip3: 'Limit outdoor playground access until after 6:30 PM when inversion lifts.',
    },
    elderly: {
      name: 'Elderly',
      badge: '▲ Cardiovascular Precaution',
      verdict: 'Maintain filtered indoor environment. Cardiovascular precaution.',
      subtext: 'Ultrafine particulate matter enters the bloodstream and increases strain on arterial walls and cardiac rhythm. Remain in filtered indoor air.',
      tag1: 'MEDICATION',
      tip1: 'Take prescribed cardiovascular medications on precise schedule.',
      tag2: 'RESTRICT',
      tip2: 'Avoid walking near busy roadside corridors or high-traffic intersections.',
      tag3: 'PLAN',
      tip3: 'Schedule brief veranda strolls only between 6:30 and 8:00 PM.',
    },
    athlete: {
      name: 'Athlete',
      badge: '▲ Pulmonary Stress High',
      verdict: 'Reschedule high-intensity training. Pulmonary stress high.',
      subtext: 'High-volume deep lung inhalation of PM2.5 impairs VO2 max and inflames bronchial alveoli within 20 minutes of intense running.',
      tag1: 'ADAPT',
      tip1: 'Shift tempo runs and threshold sprints to an indoor treadmill.',
      tag2: 'TIME WINDOW',
      tip2: 'If training outdoors, wait strictly for the low-soot window (6:30–8:00 PM).',
      tag3: 'RECOVERY',
      tip3: 'Incorporate antioxidant-rich hydration post-session to combat oxidative stress.',
    },
  }[persona];

  // Derived metrics
  const currentAqi = stationData?.currentAqi ?? 238;
  const pm25Val = stationData?.pollutants.pm2_5?.value ?? 120.4;
  const pm10Val = stationData?.pollutants.pm10?.value ?? 210.8;
  const no2Val = stationData?.pollutants.no2?.value ?? 42.1;
  const weather = stationData?.weather ?? {
    temperature: 31,
    humidity: 48,
    windSpeed: 6,
    windDirection: 310,
    surfacePressure: 1012,
    cloudCover: 10,
    weatherCode: 1,
    weatherDescription: 'Mainly Clear',
    uvIndex: 6,
  };

  // Derive duration and lung burden for routes
  const ventRate = routeMode === 'walk' ? 15 : routeMode === 'cycle' ? 30 : 45; // Liters of air inhaled per minute
  const cleanMinutes = routeMode === 'walk' ? 22 : routeMode === 'cycle' ? 9 : 14;
  const fastMinutes = routeMode === 'walk' ? 18 : routeMode === 'cycle' ? 7 : 11;
  const cleanDuration = `${cleanMinutes} min`;
  const fastDuration = `${fastMinutes} min`;
  const fastInhaledUg = Math.round((pm25Val * (ventRate * fastMinutes)) / 1000);
  const cleanInhaledUg = Math.round((pm25Val * 0.7 * (ventRate * cleanMinutes)) / 1000);
  const lungBurdenSavingsUg = Math.max(12, fastInhaledUg - cleanInhaledUg);

  // Circular gauge SVG calculations
  const circumference = 251.2;
  const normalizedAqi = Math.min(Math.max(currentAqi, 0), 500);
  const strokeOffset = circumference - (normalizedAqi / 500) * circumference;

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(18,35,46,0.04)] border-b border-surface-container/40">
        <div className="h-16 w-full px-margin-mobile md:px-margin flex items-center justify-between gap-space-md">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-space-sm cursor-pointer shrink-0"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="h-8 w-8 border-2 border-white flex items-center justify-center font-label-md text-white font-bold">A/</div>
            <span className="font-title-md text-title-md text-on-surface tracking-tight font-semibold hidden sm:inline-block">
              AIREXPO
            </span>
          </div>

          {/* Top Panel Navigation Box (Strictly visible on tablet & desktop, hidden on mobile) matching Image 2 */}
          <nav
            aria-label="Desktop Top Panel Navigation"
            className="hidden md:flex items-center gap-1 p-1 bg-surface-container-low/90 backdrop-blur-md rounded-2xl shadow-xs border border-surface-container"
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
            <div className="inline-flex items-center bg-surface-container-low rounded-lg p-space-xs text-label-caps font-label-caps text-on-surface-variant">
              {(['EN', 'HI', 'KN'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  type="button"
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


            {/* Sign in / Profile */}
            <div className="flex items-center gap-space-sm pl-space-xs">
              {userAuthEmail ? (
                <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-xl text-xs">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  <span className="font-semibold text-on-surface truncate max-w-[100px]">
                    {userAuthEmail.split('@')[0]}
                  </span>
                  <button
                    onClick={() => setUserAuthEmail(null)}
                    className="text-on-surface-variant hover:text-error ml-1 font-bold"
                    title="Sign Out"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="hidden sm:inline-flex items-center justify-center px-space-md py-space-xs text-label-md font-label-md rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all active:scale-95 shadow-sm"
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm"
                title={userAuthEmail ? `Signed in as ${userAuthEmail}` : 'Account Settings'}
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full pt-16 pb-24 md:pb-10 bg-background flex-1">
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
          {/* SIMULATION FLOATING DOCK (Bottom Right) */}
          <aside className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-space-xs pointer-events-auto">
            {demoMenuOpen && (
              <div className="flex flex-col gap-space-xs p-space-sm bg-surface-container-lowest/95 backdrop-blur-md rounded-xl shadow-xl border-0 text-label-md transition-all duration-300">
                <div className="flex items-center justify-between pb-space-xs">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold">
                    Simulate Live Conditions
                  </span>
                  <button
                    onClick={() => setDemoMenuOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface p-space-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-space-xs">
                  <button
                    onClick={() => {
                      if (stationData) {
                        setStationData({ ...stationData, currentAqi: 42 });
                      }
                    }}
                    className="px-space-sm py-space-xs rounded bg-surface-container text-left hover:bg-secondary-container transition-all flex items-center gap-space-xs text-on-surface active:scale-95"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> <span>Good (42)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (stationData) {
                        setStationData({ ...stationData, currentAqi: 125 });
                      }
                    }}
                    className="px-space-sm py-space-xs rounded bg-surface-container text-left hover:bg-surface-variant transition-all flex items-center gap-space-xs text-on-surface active:scale-95"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> <span>Moderate (125)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (stationData) {
                        setStationData({ ...stationData, currentAqi: 238 });
                      }
                    }}
                    className="px-space-sm py-space-xs rounded bg-surface-container text-left hover:bg-error-container transition-all flex items-center gap-space-xs text-on-surface active:scale-95"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span> <span>Poor (238)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (stationData) {
                        setStationData({ ...stationData, currentAqi: 412 });
                      }
                    }}
                    className="px-space-sm py-space-xs rounded bg-surface-container text-left hover:bg-error-container transition-all flex items-center gap-space-xs text-on-surface active:scale-95"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-error"></span> <span>Severe (412)</span>
                  </button>
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      const data = await fetchEnvironmentalData(currentLocation);
                      setStationData(data);
                      setIsLoading(false);
                    }}
                    className="col-span-2 py-1 px-2 rounded bg-primary-container text-on-primary font-semibold text-label-caps hover:bg-primary transition-all active:scale-95 text-center mt-1"
                  >
                    ↺ Re-fetch Live Planetary Telemetry
                  </button>
                </div>
                <div className="pt-space-xs flex gap-space-xs">
                  <button
                    onClick={() => alert('GPS Denied: Defaulting to local ground sensor.')}
                    className="flex-1 py-1 px-2 rounded bg-surface-container-high text-on-surface-variant text-label-caps hover:text-on-surface active:scale-95 transition-all"
                  >
                    GPS Denied
                  </button>
                  <button
                    onClick={() => setOfflineNotice(!offlineNotice)}
                    className="flex-1 py-1 px-2 rounded bg-surface-container-high text-on-surface-variant text-label-caps hover:text-on-surface active:scale-95 transition-all"
                  >
                    Network Offline
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              className="flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary rounded-full shadow-lg hover:bg-primary-container transition-transform active:scale-95 text-label-md font-label-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Live Simulation</span>
            </button>
          </aside>

          {/* Offline Toast Banner */}
          {offlineNotice && (
            <div className="w-full bg-tertiary text-on-tertiary px-margin py-space-xs flex items-center justify-between text-label-md transition-all">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                <span>Operating on cached atmospheric telemetry from 14 minutes ago. Reconnecting to local CPCB sensor...</span>
              </div>
              <button
                className="text-on-tertiary hover:opacity-80 active:scale-90 transition-transform"
                onClick={() => setOfflineNotice(false)}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* SECTION 1: SEARCH & DISCOVERY PORTAL */}
          <section
            className={`w-full px-margin-mobile md:px-margin pt-space-xl flex flex-col items-center text-center relative overflow-hidden transition-[padding] duration-300 ${
              isDropdownOpen && searchResults.length > 0 ? 'pb-[19rem]' : 'pb-space-lg'
            }`}
            id="hero-search-section"
          >
            {/* Ambient Aura & Drifting Particles */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[760px] h-[360px] bg-gradient-to-b from-primary-fixed/30 via-surface-container-low/40 to-transparent blur-3xl pointer-events-none -z-10"></div>
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
              className="w-full max-w-2xl bg-surface-container-lowest p-space-xs rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-space-xs relative transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-2xl"
              ref={searchContainerRef}
            >
              <div className="flex items-center flex-1 w-full px-space-md py-space-xs gap-space-sm">
                <span className="material-symbols-outlined text-outline">search</span>
                <input
                  className="w-full bg-transparent border-0 outline-none text-on-surface font-body-md text-body-md placeholder:text-outline"
                  placeholder="Search city, neighborhood, or postal station..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest border border-surface-container rounded-2xl shadow-2xl max-h-64 overflow-y-auto z-50 divide-y divide-surface-container">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentLocation(res);
                        setSearchQuery(`${res.name}, ${res.country}`);
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
                  setCurrentLocation(del);
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
                  setCurrentLocation(ben);
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
                  setCurrentLocation(mum);
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
            location={currentLocation}
            data={stationData}
            loading={isLoading}
            personaName={personaContent.name}
            onRefresh={() => setTelemetryReloadKey((value) => value + 1)}
          />

          <section className="w-full px-margin-mobile md:px-margin pb-space-xl flex flex-col gap-space-lg">
            {/* Location Meta Header & Persona Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm">
              <div>
                <div className="flex items-center gap-space-xs text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
                  <span>
                    {currentLocation.name} Monitoring Station ({currentLocation.latitude.toFixed(2)}°, {currentLocation.longitude.toFixed(2)}°)
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="text-secondary font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    Live ({stationData?.lastUpdated || '4m ago'})
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                  Good evening, here’s your air in {currentLocation.name.split(',')[0]}.
                </h2>
              </div>

              {/* PERSONA SELECTOR */}
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                  Tailor Bio-Thresholds:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 bg-surface-container-low p-1.5 rounded-xl shadow-inner">
                  {(
                    [
                      { key: 'normal', icon: '🙂', label: 'General' },
                      { key: 'asthma', icon: '🫁', label: 'Asthma' },
                      { key: 'child', icon: '🧒', label: 'Child' },
                      { key: 'elderly', icon: '👴', label: 'Elderly' },
                      { key: 'athlete', icon: '🏃', label: 'Athlete' },
                    ] as const
                  ).map((p) => {
                    const isActive = persona === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setPersona(p.key)}
                        className={`persona-btn px-space-md py-1.5 rounded-lg text-label-md font-label-md flex items-center gap-1.5 transition-all active:scale-95 ${
                          isActive
                            ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold scale-100'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                        }`}
                      >
                        <span>{p.icon}</span> <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Hero Asymmetric Block: Verdict (60%) + Micro-Weather (40%) */}
            <div className="hidden">
              {/* HERO VERDICT CARD (60% Desktop: 7 cols) */}
              <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-500">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-tertiary-fixed/40 blur-3xl pointer-events-none transition-all duration-700"></div>

                <div className="flex items-start justify-between gap-space-md z-10">
                  <div className="flex flex-col gap-1.5">
                    <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caps text-label-caps font-semibold uppercase tracking-wider transition-all duration-300 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                      <span>{personaContent.badge}</span>
                    </div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant">
                      Primary Pollutant: {stationData?.dominantPollutant || 'PM2.5'} (Fine Combustion Particles)
                    </span>
                  </div>

                  {/* Circular Breathing Pulse AQI Gauge */}
                  <div className="relative w-28 h-28 flex items-center justify-center rounded-full animate-breathe p-1 bg-surface-container-low/40">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        className="text-surface-container"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                      />
                      <circle
                        className="text-tertiary transition-all duration-1000 ease-out"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="40"
                        stroke="currentColor"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        strokeWidth="8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-data-metric text-data-metric text-on-surface leading-none tabular-nums">
                        {currentAqi}
                      </span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-1">
                        AQI-IN
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big Decision Verdict */}
                <div className="my-space-lg z-10">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                    Prescribed Action
                  </span>
                  <h3 className="font-headline-lg text-headline-lg md:text-[40px] md:leading-[46px] text-on-surface font-bold mt-1 mb-2">
                    {personaContent.verdict}
                  </h3>
                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                    {personaContent.subtext}
                  </p>
                </div>

                {/* Micro Particulate Diagnostic Readouts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-space-md border-0 bg-surface-container-low/60 p-space-md rounded-xl z-10">
                  <div className="transition-transform duration-200 hover:-translate-y-0.5">
                    <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                      PM2.5 Conc.
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-headline-md text-headline-md text-on-surface tabular-nums">
                        {pm25Val}
                      </span>
                      <span className="text-label-caps text-on-surface-variant">µg/m³</span>
                    </div>
                    <span className="text-[11px] text-tertiary font-medium">
                      {(pm25Val / 15).toFixed(1)}× WHO guide
                    </span>
                  </div>

                  <div className="transition-transform duration-200 hover:-translate-y-0.5">
                    <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                      PM10 Conc.
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-headline-md text-headline-md text-on-surface tabular-nums">
                        {pm10Val}
                      </span>
                      <span className="text-label-caps text-on-surface-variant">µg/m³</span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">
                      {(pm10Val / 45).toFixed(1)}× WHO guide
                    </span>
                  </div>

                  <div className="transition-transform duration-200 hover:-translate-y-0.5">
                    <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                      Nitrogen Dioxide
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-headline-md text-headline-md text-on-surface tabular-nums">
                        {no2Val}
                      </span>
                      <span className="text-label-caps text-on-surface-variant">ppb</span>
                    </div>
                    <span className="text-[11px] text-secondary font-medium">Moderate</span>
                  </div>

                  <div className="transition-transform duration-200 hover:-translate-y-0.5">
                    <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                      Air Cleanliness
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-headline-md text-headline-md text-on-surface">
                        {stationData?.aqiCategory.label || 'Poor'}
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">Inversion layer active</span>
                  </div>
                </div>
              </div>

              {/* WEATHER & ATMOSPHERE STRIP (40% Desktop: 5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-space-md">
                {/* Micro-Weather Card */}
                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm flex flex-col justify-between flex-1">
                  <div className="flex items-center justify-between pb-space-sm">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-primary text-[20px]">thermostat</span>
                      <span className="font-title-md text-title-md text-on-surface">
                        Surface Atmospheric Mechanics
                      </span>
                    </div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                      Ground Sensor
                    </span>
                  </div>

                  {/* Weather Tiles with Interactive Hover Tooltips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm my-space-sm">
                    {/* Temp */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">☀️</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">Temp</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-on-surface font-semibold tabular-nums">
                        {weather.temperature}°C
                      </div>
                      <span className="text-label-caps text-on-surface-variant">Feels {weather.temperature + 2}°C</span>
                    </div>

                    {/* Humidity */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">💧</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">Humidity</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-on-surface font-semibold tabular-nums">
                        {weather.humidity}%
                      </div>
                      <span className="text-label-caps text-secondary font-medium">Optimal balance</span>
                    </div>

                    {/* Wind */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">💨</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">Wind</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-on-surface font-semibold tabular-nums">
                        {weather.windSpeed} km/h
                      </div>
                      <span className="text-label-caps text-tertiary font-medium">Stagnant NW</span>
                    </div>

                    {/* Precip */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">🌧</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">Precip</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-on-surface font-semibold tabular-nums">
                        10%
                      </div>
                      <span className="text-label-caps text-on-surface-variant">Dry evening</span>
                    </div>

                    {/* UV */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">☀️</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">UV</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-on-surface font-semibold tabular-nums">
                        UV {weather.uvIndex}
                      </div>
                      <span className="text-label-caps text-on-surface-variant">Moderate high</span>
                    </div>

                    {/* Venting */}
                    <div className="sensor-tile p-space-sm bg-surface-container-low rounded-xl group relative cursor-pointer hover:bg-surface-container hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant text-[18px]">🪟</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">Venting</span>
                      </div>
                      <div className="mt-2 font-headline-md text-headline-md text-tertiary font-semibold">
                        {currentAqi > 100 ? 'Close' : 'Open'}
                      </div>
                      <span className="text-label-caps text-on-surface-variant">
                        {currentAqi > 100 ? 'Keep sealed' : 'Safe to ventilate'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-xs p-space-sm rounded-xl bg-surface-container text-label-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px] text-primary">info</span>
                    <span>Micro-climatic sensor linked to regional meteorological radar.</span>
                  </div>
                </div>

                {/* 3 Tailored Action Tips */}
                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-space-sm">
                    <div>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider block">
                        Targeted Bio-Directives
                      </span>
                      <span className="font-title-md text-title-md text-on-surface font-semibold">
                        What should you do? · {personaContent.name}
                      </span>
                    </div>

                  </div>

                  <div className="space-y-space-xs">
                    <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-low transition-all duration-300 hover:bg-surface-container hover:translate-x-1">
                      <span className="w-6 h-6 rounded-full bg-surface-container text-primary flex items-center justify-center font-bold text-label-caps shrink-0">
                        01
                      </span>
                      <div>
                        <span className="font-label-caps text-label-caps text-primary uppercase font-bold block">
                          {personaContent.tag1}
                        </span>
                        <p className="text-body-md font-body-md text-on-surface">{personaContent.tip1}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-low transition-all duration-300 hover:bg-surface-container hover:translate-x-1">
                      <span className="w-6 h-6 rounded-full bg-surface-container text-tertiary flex items-center justify-center font-bold text-label-caps shrink-0">
                        02
                      </span>
                      <div>
                        <span className="font-label-caps text-label-caps text-tertiary uppercase font-bold block">
                          {personaContent.tag2}
                        </span>
                        <p className="text-body-md font-body-md text-on-surface">{personaContent.tip2}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-low transition-all duration-300 hover:bg-surface-container hover:translate-x-1">
                      <span className="w-6 h-6 rounded-full bg-surface-container text-secondary flex items-center justify-center font-bold text-label-caps shrink-0">
                        03
                      </span>
                      <div>
                        <span className="font-label-caps text-label-caps text-secondary uppercase font-bold block">
                          {personaContent.tag3}
                        </span>
                        <p className="text-body-md font-body-md text-on-surface">{personaContent.tip3}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SATELLITE VIEW FOR AQI SECTION (User requested: "and also use this satellite view for AQI") */}
          {userAuthEmail ? (
            <HealthWorkspace
              stationData={stationData}
              onModeChange={(mode) => setPersona(mode === 'everyday' ? 'normal' : mode)}
            />
          ) : (
            <section className="w-full px-margin-mobile md:px-margin pb-space-xl">
              <div className="bg-surface-container-lowest border border-primary rounded-2xl p-7 md:p-10 shadow-[6px_6px_0_#10162f] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="max-w-2xl">
                  <span className="font-label-caps uppercase text-primary">Private member area</span>
                  <h2 className="font-headline-lg text-headline-lg mt-2">Sign in to unlock your personal health workspace</h2>
                  <p className="text-on-surface-variant mt-2">Profile questions, fitness assessment, symptom history, and prescription uploads remain hidden until authentication.</p>
                </div>
                <button onClick={() => setAuthModalOpen(true)} className="px-6 py-3 bg-secondary text-on-secondary border border-primary rounded font-label-md shadow-[4px_4px_0_#10162f]">Sign In</button>
              </div>
            </section>
          )}

          <section className="w-full px-margin-mobile md:px-margin pb-space-xl" id="satellite-section">
            <div className="flex flex-col gap-space-md">
              <SatelliteViewer
                coordinates={{
                  lat: currentLocation.latitude,
                  lon: currentLocation.longitude,
                }}
                locationName={`${currentLocation.name}, ${currentLocation.country}`}
                currentAqi={currentAqi}
                windDirection={weather.windDirection}
                windSpeed={weather.windSpeed}
                pm25={pm25Val}
                cloudCover={weather.cloudCover}
                elevation={currentLocation.elevation}
                onSelectCoordinates={async (coords) => {
                  const rev = await reverseGeocode(coords);
                  setCurrentLocation(rev);
                  setSearchQuery(`${rev.name}, ${rev.country}`);
                }}
              />
            </div>
          </section>

          {/* SECTION 3: 24-HOUR BREATHING TIMELINE */}
          <section className="w-full px-margin-mobile md:px-margin pb-space-xl" id="timeline-section">
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm flex flex-col gap-space-lg">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
                <div>
                  <div className="inline-flex items-center gap-space-xs text-secondary font-label-caps text-label-caps uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    Diurnal Exposure Modeling
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    Your 24-Hour Breathing Timeline
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    See when today’s atmosphere is cleanest and easiest on your bronchial pathways.
                  </p>
                </div>

                <div className="flex items-center gap-space-sm">
                  <button
                    onClick={() => scheduleAlertForHour('6:30 PM (Cleanest Breathing Window)')}
                    className="hidden sm:flex items-center gap-space-xs bg-secondary-container/50 hover:bg-secondary-container text-on-secondary-container px-space-md py-1.5 rounded-xl font-label-md text-label-md font-semibold shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Click to schedule alert for cleanest window"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Best Window: 6:30 PM – 8:00 PM (~82 AQI)</span>
                  </button>
                  <div className="flex bg-surface-container-low p-1 rounded-xl shadow-inner">
                    <button
                      onClick={() => setTimelineView('bars')}
                      className={`px-space-md py-1 rounded-lg text-label-md font-label-md transition-all active:scale-95 ${
                        timelineView === 'bars'
                          ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                      type="button"
                    >
                      Visual Bars
                    </button>
                    <button
                      onClick={() => setTimelineView('list')}
                      className={`px-space-md py-1 rounded-lg text-label-md font-label-md transition-all active:scale-95 ${
                        timelineView === 'list'
                          ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                      type="button"
                    >
                      Accessible List
                    </button>
                  </div>
                </div>
              </div>

              {/* VISUAL BARS VIEW */}
              {timelineView === 'bars' && stationData && (
                <div className="flex flex-col gap-space-md">
                  <div className="relative w-full bg-surface-container-low/40 p-space-md rounded-2xl overflow-x-auto">
                    {/* Best Window Highlight */}
                    <div className="absolute top-0 bottom-0 left-[67.5%] w-[12.5%] bg-secondary-container/30 border-2 border-secondary/40 rounded-xl pointer-events-none flex flex-col justify-between py-2 px-1 pulse-best-window z-0">
                      <span className="font-label-caps text-[10px] text-secondary font-bold text-center tracking-tighter uppercase">
                        ★ Best Air
                      </span>
                      <span className="font-label-caps text-[10px] text-secondary font-semibold text-center">
                        82 AQI
                      </span>
                    </div>

                    {/* 24-Hour Track */}
                    <div className="min-w-[760px] h-52 flex items-end justify-between gap-1.5 pt-8 pb-4 relative z-10">
                      {stationData.hourlyTimeline.slice(0, 24).map((item, index) => {
                        const heightPercent = Math.min(100, Math.max(18, (item.aqi / 350) * 100));
                        const isNow = index === 0;

                        let colorClass = 'bg-secondary';
                        if (item.aqi > 50 && item.aqi <= 100) colorClass = 'bg-secondary-fixed-dim';
                        else if (item.aqi > 100 && item.aqi <= 200) colorClass = 'bg-primary';
                        else if (item.aqi > 200 && item.aqi <= 300) colorClass = 'bg-tertiary';
                        else if (item.aqi > 300) colorClass = 'bg-error';

                        return (
                          <div
                            key={index}
                            onClick={() => setSelectedTimelineHour(item)}
                            className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer select-none"
                          >
                            <div
                              style={{ height: `${heightPercent}%`, animationDelay: `${index * 35}ms` }}
                              className={`grow-bar w-full rounded-t-sm transition-all duration-200 ${colorClass} ${
                                selectedTimelineHour?.formattedTime === item.formattedTime
                                  ? 'ring-2 ring-on-surface ring-offset-2 scale-y-105'
                                  : 'opacity-85 group-hover:opacity-100 group-hover:-translate-y-1'
                              }`}
                            />
                            <span
                              className={`font-label-caps text-[10px] mt-2 transition-colors ${
                                isNow ? 'font-bold text-on-surface underline' : 'text-on-surface-variant'
                              }`}
                            >
                              {item.formattedTime}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Hour Detail Card */}
                  {selectedTimelineHour && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-space-md bg-surface-container-low rounded-xl gap-space-md transition-all duration-300">
                      <div className="flex items-center gap-space-md">
                        <div className="w-12 h-12 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed flex flex-col items-center justify-center font-bold shadow-sm">
                          <span className="text-title-md font-title-md leading-none tabular-nums">
                            {selectedTimelineHour.aqi}
                          </span>
                          <span className="text-[9px] uppercase tracking-tighter">AQI</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-space-xs">
                            <span className="font-title-md text-title-md text-on-surface">
                              {selectedTimelineHour.formattedTime} ({selectedTimelineHour.dayLabel})
                            </span>
                            <span
                              className="px-2 py-0.5 rounded text-label-caps font-label-caps font-semibold uppercase text-white"
                              style={{ backgroundColor: selectedTimelineHour.color }}
                            >
                              {selectedTimelineHour.statusLabel}
                            </span>
                          </div>
                          <p className="text-body-sm font-body-sm text-on-surface-variant">
                            PM2.5: {selectedTimelineHour.pm2_5} µg/m³ · Temp: {selectedTimelineHour.temperature}°C · Wind: {selectedTimelineHour.windSpeed} km/h
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => scheduleAlertForHour(`${selectedTimelineHour.formattedTime} (AQI ${selectedTimelineHour.aqi})`)}
                        className="w-full sm:w-auto px-space-md py-space-xs bg-primary text-on-primary rounded-lg text-label-md font-label-md hover:bg-primary-container transition-all shadow-sm active:scale-95"
                        type="button"
                      >
                        Schedule Alert for This Slot →
                      </button>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-space-md pt-space-xs text-label-caps font-label-caps text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <span>● Good (0–50)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim"></span>
                      <span>● Satisfactory (51–100)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
                      <span>▲ Moderate (101–200)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-tertiary"></span>
                      <span>▲ Poor (201–300)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-error"></span>
                      <span>■ Severe (401+)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ACCESSIBLE LIST VIEW */}
              {timelineView === 'list' && stationData && (
                <div className="flex flex-col divide-y divide-surface-container overflow-hidden rounded-xl bg-surface-container-low/30">
                  {stationData.hourlyTimeline.slice(0, 24).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-space-sm hover:bg-surface-container transition-all text-label-md"
                    >
                      <div className="flex items-center gap-space-md">
                        <span className="font-bold w-14 text-on-surface">{item.formattedTime}</span>
                        <div>
                          <div className="font-semibold text-on-surface flex items-center gap-2">
                            <span>AQI {item.aqi}</span>
                            {idx === 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <span className="text-body-sm text-on-surface-variant">
                            PM2.5: {item.pm2_5} µg/m³ · Ozone: {item.o3} µg/m³
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTimelineHour(item)}
                        className="px-space-sm py-1 rounded bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary text-label-caps uppercase transition-all active:scale-95"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 4: CLEANER ROUTE INTERACTIVE EXPERIENCE */}
          <section className="w-full px-margin-mobile md:px-margin pb-space-xl" id="routes-section">
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm flex flex-col gap-space-lg">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
                <div>
                  <div className="inline-flex items-center gap-space-xs text-primary font-label-caps text-label-caps uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[16px]">alt_route</span>
                    Respiratory Route Navigation
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    Take the Cleaner Way
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Trade four minutes of travel for up to 30% fewer inhaled ultrafine particles.
                  </p>
                </div>

                {/* Transit Mode Selector */}
                <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl shadow-inner">
                  {(['walk', 'cycle', 'run'] as const).map((m) => {
                    const isActive = routeMode === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setRouteMode(m)}
                        className={`mode-pill px-space-md py-1.5 rounded-lg text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 ${
                          isActive
                            ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                        type="button"
                      >
                        <span>{m === 'walk' ? '🚶' : m === 'cycle' ? '🚲' : '🏃'}</span>
                        <span className="capitalize">{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
                {/* Controls & Route Cards */}
                <div className="lg:col-span-5 flex flex-col gap-space-md">
                  <div className="bg-surface-container-low p-space-md rounded-xl space-y-space-sm shadow-inner">
                    <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-2.5 rounded-lg shadow-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <div className="flex-1">
                        <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                          Origin
                        </span>
                        <input
                          className="w-full bg-transparent text-label-md font-label-md text-on-surface outline-none"
                          type="text"
                          value={routeOrigin}
                          onChange={(e) => setRouteOrigin(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end -my-1 pr-2">
                      <button
                        onClick={() => {
                          const temp = routeOrigin;
                          setRouteOrigin(routeDestination);
                          setRouteDestination(temp);
                        }}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-primary hover:text-white text-on-surface-variant text-[11px] transition-colors flex items-center gap-1 shadow-xs"
                        title="Swap Origin and Destination"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">swap_vert</span>
                        <span>Swap</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-2.5 rounded-lg shadow-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                      <div className="flex-1">
                        <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase">
                          Destination
                        </span>
                        <input
                          className="w-full bg-transparent text-label-md font-label-md text-on-surface outline-none"
                          type="text"
                          value={routeDestination}
                          onChange={(e) => setRouteDestination(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Impact Banner */}
                  <div className="bg-secondary-container/40 p-space-md rounded-xl flex items-center gap-space-sm shadow-sm">
                    <span className="material-symbols-outlined text-secondary text-[24px]">energy_savings_leaf</span>
                    <div className="text-label-md font-label-md text-on-secondary-container">
                      <span className="font-bold">+4 minutes</span> via Park Corridor avoids heavy vehicular exhaust, reducing inhaled particulate mass by <span className="font-bold underline">≈{lungBurdenSavingsUg}µg</span>.
                    </div>
                  </div>

                  {/* Cleanest Route Card */}
                  <div
                    onClick={() => setActiveRoute('clean')}
                    className={`route-card p-space-md rounded-xl cursor-pointer transition-all flex flex-col gap-space-xs hover:-translate-y-0.5 ${
                      activeRoute === 'clean'
                        ? 'border-2 border-primary-container bg-surface-container-lowest shadow-md'
                        : 'border-2 border-transparent bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="px-2 py-0.5 rounded text-label-caps font-label-caps bg-secondary-container text-on-secondary-container font-semibold uppercase">
                          🌿 Cleanest Route
                        </span>
                        <span className="text-label-caps font-label-caps text-secondary font-semibold">
                          Recommended
                        </span>
                      </div>
                      <span className="font-headline-md text-headline-md text-primary font-bold">
                        {cleanDuration}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-body-md font-body-md text-on-surface">
                      <span>Via Greenway & Tree Canopy Corridor</span>
                      <span className="text-on-surface-variant">2.8 km</span>
                    </div>
                    <div className="flex items-center gap-space-md pt-space-xs text-label-caps font-label-caps text-on-surface-variant">
                      <span className="flex items-center gap-1 text-secondary font-semibold">
                        <span className="material-symbols-outlined text-[14px]">format_image_left</span>
                        Avg AQI 122 (Moderate)
                      </span>
                      <span>•</span>
                      <span>-30% PM2.5 Inhalation</span>
                    </div>
                  </div>

                  {/* Fastest Route Card */}
                  <div
                    onClick={() => setActiveRoute('fast')}
                    className={`route-card p-space-md rounded-xl cursor-pointer transition-all flex flex-col gap-space-xs hover:-translate-y-0.5 ${
                      activeRoute === 'fast'
                        ? 'border-2 border-tertiary bg-surface-container-lowest shadow-md'
                        : 'border-2 border-transparent bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="px-2 py-0.5 rounded text-label-caps font-label-caps bg-surface-container-high text-on-surface-variant font-semibold uppercase">
                          ⚡ Fastest Route
                        </span>
                        <span className="text-label-caps font-label-caps text-tertiary font-semibold">
                          Heavy Soot
                        </span>
                      </div>
                      <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                        {fastDuration}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-body-md font-body-md text-on-surface">
                      <span>Via Outer Ring Road Flyover</span>
                      <span className="text-on-surface-variant">2.4 km</span>
                    </div>
                    <div className="flex items-center gap-space-md pt-space-xs text-label-caps font-label-caps text-on-surface-variant">
                      <span className="flex items-center gap-1 text-tertiary font-semibold">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Avg AQI 245 (Poor)
                      </span>
                      <span>•</span>
                      <span>High diesel soot corridor</span>
                    </div>
                  </div>
                </div>

                <GoogleJoggingMap
                  center={{ lat: currentLocation.latitude, lon: currentLocation.longitude }}
                  activeRoute={activeRoute}
                  onRouteChange={setActiveRoute}
                />

                {/* Legacy schematic retained for reference but replaced by the satellite map */}
                <div className="hidden lg:col-span-7 bg-surface-container-low rounded-2xl overflow-hidden relative shadow-inner min-h-[380px] flex-col justify-between p-space-md">
                  <div className="absolute inset-0 z-0 bg-[#e5f0f6] opacity-95">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern height="40" id="routeGrid" patternUnits="userSpaceOnUse" width="40">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4e3ec" strokeWidth="1"></path>
                        </pattern>
                        <linearGradient id="cleanRouteGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                          <stop offset="0%" stopColor="#006d38"></stop>
                          <stop offset="100%" stopColor="#0b7a8a"></stop>
                        </linearGradient>
                      </defs>
                      <rect fill="url(#routeGrid)" height="100%" width="100%"></rect>

                      {/* Green park zone */}
                      <path
                        d="M 120,40 Q 240,110 380,80 T 560,190"
                        fill="none"
                        opacity="0.6"
                        stroke="#b4e4c3"
                        strokeLinecap="round"
                        strokeWidth="26"
                      ></path>
                      <text fill="#006d38" fontSize="11" fontWeight="600" opacity="0.8" x="260" y="90">
                        Bio Park Corridor
                      </text>

                      {/* FAST ROUTE PATH */}
                      <path
                        className={`transition-all duration-500 cursor-pointer ${
                          activeRoute === 'fast' ? 'opacity-90 stroke-[7px]' : 'opacity-40 stroke-[4px]'
                        }`}
                        d="M 80,290 L 160,260 L 320,240 L 460,190 L 520,110"
                        fill="none"
                        onClick={() => setActiveRoute('fast')}
                        stroke="#9f2946"
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                      ></path>

                      {/* CLEAN ROUTE PATH */}
                      <path
                        className={`transition-all duration-500 drop-shadow-md cursor-pointer ${
                          activeRoute === 'clean' ? 'opacity-100 stroke-[8px]' : 'opacity-40 stroke-[4px]'
                        }`}
                        d="M 80,290 C 130,220 220,140 330,120 S 440,140 520,110"
                        fill="none"
                        onClick={() => setActiveRoute('clean')}
                        stroke="url(#cleanRouteGrad)"
                        strokeLinecap="round"
                      ></path>

                      {/* Animated Flow on clean route */}
                      {activeRoute === 'clean' && (
                        <path
                          className="animated-route-flow pointer-events-none opacity-80"
                          d="M 80,290 C 130,220 220,140 330,120 S 440,140 520,110"
                          fill="none"
                          stroke="#8af6a9"
                          strokeLinecap="round"
                          strokeWidth="3"
                        ></path>
                      )}

                      {/* Origin Marker */}
                      <g transform="translate(80, 290)">
                        <circle className="animate-ping" fill="#006d38" opacity="0.2" r="14"></circle>
                        <circle fill="#006d38" r="8"></circle>
                        <circle fill="#ffffff" r="4"></circle>
                        <text fill="#0c1d28" fontSize="11" fontWeight="700" x="14" y="4">
                          Home ({currentLocation.name.split(',')[0]})
                        </text>
                      </g>

                      {/* Destination Marker */}
                      <g transform="translate(520, 110)">
                        <circle className="animate-ping" fill="#00606d" opacity="0.2" r="14"></circle>
                        <circle fill="#00606d" r="8"></circle>
                        <circle fill="#ffffff" r="4"></circle>
                        <text fill="#0c1d28" fontSize="11" fontWeight="700" x="-94" y="-10">
                          College (Campus)
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Top Map Badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-md py-1 rounded-full text-label-caps font-label-caps text-on-surface shadow-sm font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                      Live Particulate Exposure Heat-Mesh Active
                    </span>
                  </div>

                  {/* Bottom Map Legend */}
                  <div className="relative z-10 bg-surface-container-lowest/90 backdrop-blur-md p-space-sm rounded-xl shadow-md flex items-center justify-between text-label-caps font-label-caps text-on-surface-variant">
                    <div className="flex items-center gap-space-sm">
                      <span className="flex items-center gap-1 text-primary font-semibold">
                        <span className="w-3 h-1 bg-primary rounded"></span> Clean Corridor
                      </span>
                      <span className="flex items-center gap-1 text-tertiary">
                        <span className="w-3 h-1 bg-tertiary border-dashed rounded"></span> High Soot Artery
                      </span>
                    </div>
                    <span className="font-medium text-on-surface">
                      {activeRoute === 'clean'
                        ? 'Estimated lung burden: -320µg'
                        : 'Estimated lung burden: +480µg soot exposure'}
                    </span>
                  </div>
                </div>
              </div>
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
                            className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
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
                  Syncs with wearable & home smart purifiers
                </span>
                <button onClick={() => setAuthModalOpen(true)} className="text-primary hover:underline font-semibold">
                  Manage all places
                </button>
              </div>
            </div>

            {/* Air Alerts Config Panel */}
            <div
              className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm flex flex-col justify-between"
              id="alerts-section"
            >
              <div>
                <div className="flex items-center justify-between pb-space-sm">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider block">
                      Bio-Protective Guard
                    </span>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Real-Time Air Alerts
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-caps font-semibold uppercase">
                    Active Guard
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                  Receive proactive advisories before particulate spikes breach your respiratory sensitivity threshold.
                </p>

                {/* Active Threshold Breach Warning */}
                {currentAqi >= alertThreshold && (
                  <div className="mb-space-sm p-space-sm rounded-xl bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-between text-xs font-semibold shadow-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
                      <span>Warning: Active AQI ({currentAqi}) breaches threshold ({alertThreshold})</span>
                    </span>
                    <span className="text-[10px] uppercase bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded font-bold">
                      Triggered
                    </span>
                  </div>
                )}

                {/* AQI Range Slider */}
                <div className="bg-surface-container-low p-space-md rounded-xl space-y-space-xs mb-space-md shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Trigger Alert When AQI Exceeds
                    </span>
                    <span className="font-headline-md text-headline-md text-primary font-bold tabular-nums">
                      {alertThreshold} AQI
                    </span>
                  </div>
                  <input
                    className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
                    max="400"
                    min="50"
                    step="10"
                    type="range"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))}
                  />
                  <div className="flex justify-between text-[11px] font-label-caps text-on-surface-variant">
                    <span>50 (Sensitive)</span>
                    <span>200 (Default)</span>
                    <span>350 (Severe Only)</span>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <label className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">Push Notifications</div>
                        <div className="text-[11px] text-on-surface-variant">Instant 30-min spike forecasts</div>
                      </div>
                    </div>
                    <input defaultChecked className="w-4 h-4 accent-primary rounded cursor-pointer" type="checkbox" />
                  </label>
                  <label className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">sms</span>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">SMS Critical Alerts</div>
                        <div className="text-[11px] text-on-surface-variant">Reserved strictly for Severe (&gt;300) events</div>
                      </div>
                    </div>
                    <input defaultChecked className="w-4 h-4 accent-primary rounded cursor-pointer" type="checkbox" />
                  </label>
                </div>
              </div>

              <div className="pt-space-md">
                <button
                  onClick={() => alert(`Alert parameters saved: Alerts trigger whenever concentrations exceed ${alertThreshold} AQI.`)}
                  className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary-container transition-all active:scale-95 shadow-md font-semibold"
                  type="button"
                >
                  Save Alert Preferences
                </button>
              </div>
            </div>
          </section>

          {/* ADD PLACE MODAL */}
          {addPlaceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm p-margin-mobile">
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-md shadow-2xl flex flex-col gap-space-md">
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

          {/* AUTH MODAL */}
          {authModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm p-margin-mobile">
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl w-full max-w-md shadow-2xl flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <div className="h-8 w-8 border-2 border-primary flex items-center justify-center font-label-md font-bold">A/</div>
                    <span className="font-title-md text-title-md font-semibold text-on-surface">
                      Sign in to AirExpo
                    </span>
                  </div>
                  <button onClick={() => setAuthModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Keep your monitored places, medical respiratory thresholds, and cleaner daily commutes unified across all personal devices.
                </p>
                <div className="space-y-space-sm">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={authInputEmail}
                    onChange={(e) => setAuthInputEmail(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md outline-none focus:ring-2 focus:ring-primary shadow-inner text-xs"
                  />
                  <button
                    onClick={() => {
                      if (!/^\S+@\S+\.\S+$/.test(authInputEmail)) return;
                      setUserAuthEmail(authInputEmail);
                      setAuthModalOpen(false);
                    }}
                    disabled={!/^\S+@\S+\.\S+$/.test(authInputEmail)}
                    className="w-full flex items-center justify-center gap-space-sm py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-semibold transition-all active:scale-95 shadow-sm disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                    Continue with Email
                  </button>
                  <p className="text-xs text-on-surface-variant">Local demo sign-in. Connect the included Cognito infrastructure before accepting real medical records.</p>
                </div>
                <div className="text-center pt-space-xs">
                  <button
                    onClick={() => setAuthModalOpen(false)}
                    className="text-label-md text-on-surface-variant hover:text-on-surface underline"
                  >
                    Close
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
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(18,35,46,0.08)] h-16 px-1 items-center justify-around border-t border-surface-container"
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
              Atmospheric Bio-Telemetry · NASA GIBS & Open-Meteo
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
