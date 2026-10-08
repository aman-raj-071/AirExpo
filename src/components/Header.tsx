import React, { useState, useEffect, useRef } from 'react';
import { LocationInfo } from '../types/environmental';
import { PRESET_LOCATIONS, searchLocations } from '../services/openMeteoApi';
import { Search, MapPin, Navigation, Compass, Layers, Clock, Check, Loader2 } from 'lucide-react';

interface HeaderProps {
  currentLocation: LocationInfo;
  onSelectLocation: (location: LocationInfo) => void;
  activeTab: 'telemetry' | 'satellite' | 'timeline' | 'diagnostic' | 'matrix';
  onTabChange: (tab: 'telemetry' | 'satellite' | 'timeline' | 'diagnostic' | 'matrix') => void;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentLocation,
  onSelectLocation,
  activeTab,
  onTabChange,
  lastUpdated,
  onRefresh,
  isRefreshing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HTML5 Geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const userLoc: LocationInfo = {
          name: 'My Current Location',
          country: 'Local Device',
          latitude: coords.lat,
          longitude: coords.lon,
        };
        onSelectLocation(userLoc);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const navTabs: { id: 'telemetry' | 'satellite' | 'timeline' | 'diagnostic' | 'matrix'; label: string }[] = [
    { id: 'telemetry', label: 'Hyper-Local Telemetry' },
    { id: 'satellite', label: 'Satellite Studio' },
    { id: 'timeline', label: '72h Exposure Scrubber' },
    { id: 'diagnostic', label: 'Diagnostic Synthesis' },
    { id: 'matrix', label: 'Global Matrix' },
  ];

  return (
    <header className="border-b border-[#D5E1E8] bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Branding & Search Tier */}
        <div className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0B7A8A] flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg text-[#12232E] tracking-tight">
                  AETHERIC PRECISION
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold font-label text-[#0B7A8A] bg-[#0B7A8A]/10 px-2 py-0.5 rounded-sm">
                  Atmospheric Engine
                </span>
              </div>
              <p className="text-xs text-[#4A5F6D] font-body -mt-0.5">
                Satellite & Ground-Level Environmental Intelligence
              </p>
            </div>
          </div>

          {/* Search bar & Geolocation button */}
          <div className="flex items-center gap-2 flex-1 max-w-md" ref={searchContainerRef}>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#4A5F6D]">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0B7A8A]" />
                ) : (
                  <Search className="w-4 h-4 text-[#4A5F6D]" />
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setIsDropdownOpen(true)}
                placeholder="Search global city, coordinates, or region..."
                className="w-full pl-9 pr-3 py-2 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl text-xs font-body text-[#12232E] placeholder-[#4A5F6D] focus:outline-none focus:border-[#0B7A8A] focus:bg-white transition-all"
              />

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D5E1E8] rounded-xl shadow-lg max-h-64 overflow-y-auto z-50 divide-y divide-[#D5E1E8]">
                  {searchResults.map((loc, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelectLocation(loc);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#F2F7FA] transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#12232E] font-display">
                          {loc.name}
                        </div>
                        <div className="text-[11px] text-[#4A5F6D] font-body">
                          {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <span className="text-[10px] text-[#4A5F6D] font-label tabular-nums">
                        {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GPS Locate Me Button */}
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              className="p-2 border border-[#D5E1E8] rounded-xl bg-white hover:bg-[#F2F7FA] text-[#0B7A8A] transition-colors flex items-center justify-center shrink-0"
              title="Use Current Device GPS"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#0B7A8A]" />
              ) : (
                <Navigation className="w-4 h-4 text-[#0B7A8A]" />
              )}
            </button>
          </div>
        </div>

        {/* Preset quick buttons & Navigation Tabs */}
        <div className="py-2.5 border-t border-[#D5E1E8] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Monitoring Zones */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-[#4A5F6D] font-label shrink-0 mr-1 uppercase">
              Stations:
            </span>
            {PRESET_LOCATIONS.slice(0, 6).map((preset) => {
              const isSelected = preset.name === currentLocation.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => onSelectLocation(preset)}
                  className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-all font-label ${
                    isSelected
                      ? 'bg-[#0B7A8A] text-white font-medium shadow-xs'
                      : 'text-[#4A5F6D] hover:text-[#12232E] hover:bg-[#F2F7FA] border border-transparent hover:border-[#D5E1E8]'
                  }`}
                >
                  {preset.name.split(' (')[0]}
                </button>
              );
            })}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl">
            {navTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-1 text-xs font-label font-medium rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-[#12232E] shadow-xs border border-[#D5E1E8]'
                      : 'text-[#4A5F6D] hover:text-[#12232E]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
