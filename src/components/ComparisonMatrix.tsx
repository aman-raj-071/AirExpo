import React, { useState, useEffect } from 'react';
import { EnvironmentalStationData, LocationInfo } from '../types/environmental';
import { PRESET_LOCATIONS, fetchEnvironmentalData } from '../services/openMeteoApi';
import { ArrowUpDown, Globe2, Wind, Thermometer, ShieldCheck, ArrowRight } from 'lucide-react';

interface ComparisonMatrixProps {
  currentStation: EnvironmentalStationData;
  onSelectLocation: (loc: LocationInfo) => void;
}

interface BenchmarkStationSummary {
  location: LocationInfo;
  aqi: number;
  categoryLabel: string;
  categoryColor: string;
  pm2_5: number;
  temp: number;
  humidity: number;
  windSpeed: number;
  dominantPollutant: string;
  deltaAqi: number; // vs current station
}

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  currentStation,
  onSelectLocation,
}) => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkStationSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadBenchmarks() {
      setIsLoading(true);
      try {
        const promises = PRESET_LOCATIONS.map(async (loc) => {
          try {
            const data = await fetchEnvironmentalData(loc);
            return {
              location: loc,
              aqi: data.currentAqi,
              categoryLabel: data.aqiCategory.label,
              categoryColor: data.aqiCategory.color,
              pm2_5: data.pollutants.pm2_5?.value ?? 0,
              temp: data.weather.temperature,
              humidity: data.weather.humidity,
              windSpeed: data.weather.windSpeed,
              dominantPollutant: data.dominantPollutant,
              deltaAqi: data.currentAqi - currentStation.currentAqi,
            };
          } catch (_e) {
            return null;
          }
        });

        const results = await Promise.all(promises);
        if (isMounted) {
          const valid = results.filter((r): r is BenchmarkStationSummary => r !== null);
          setBenchmarks(valid);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBenchmarks();

    return () => {
      isMounted = false;
    };
  }, [currentStation.location.name, currentStation.currentAqi]);

  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#D5E1E8]">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
            Global Biosphere Baselines
          </span>
          <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
            Cross-Regional Atmospheric Matrix
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#4A5F6D] font-label">
          <span>Active Baseline: <strong className="text-[#12232E]">{currentStation.location.name} (AQI {currentStation.currentAqi})</strong></span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-xs text-[#4A5F6D]">
          <Globe2 className="w-6 h-6 text-[#0B7A8A] animate-spin mb-2" />
          <span>Polling planetary monitoring stations...</span>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#D5E1E8] text-[#4A5F6D] font-label">
                <th className="py-3 px-3 font-semibold">Monitoring Station</th>
                <th className="py-3 px-3 font-semibold">Region / Biome</th>
                <th className="py-3 px-3 font-semibold">AQI Status</th>
                <th className="py-3 px-3 font-semibold">PM2.5 (µg/m³)</th>
                <th className="py-3 px-3 font-semibold">Micro-Climate</th>
                <th className="py-3 px-3 font-semibold">Delta vs Active</th>
                <th className="py-3 px-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E1E8]">
              {benchmarks.map((bm, idx) => {
                const isCurrent = bm.location.name === currentStation.location.name;
                const isCleaner = bm.deltaAqi < 0;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-[#F2F7FA] transition-colors ${
                      isCurrent ? 'bg-[#F2F7FA]/70 font-medium' : ''
                    }`}
                  >
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-[#12232E] font-display text-sm">
                        {bm.location.name}
                      </div>
                      <div className="text-[11px] text-[#4A5F6D] font-label">
                        {bm.location.latitude.toFixed(2)}°, {bm.location.longitude.toFixed(2)}°
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-[#4A5F6D] font-body">
                      {bm.location.country}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: bm.categoryColor }}
                        />
                        <span className="font-bold font-display text-sm tabular-nums text-[#12232E]">
                          {bm.aqi}
                        </span>
                        <span className="text-[11px] text-[#4A5F6D] font-label hidden sm:inline">
                          ({bm.categoryLabel})
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-label tabular-nums text-[#12232E]">
                      {bm.pm2_5} µg/m³
                    </td>

                    <td className="py-3.5 px-3 text-[#4A5F6D] font-label tabular-nums">
                      {bm.temp}°C · {bm.windSpeed} km/h
                    </td>

                    <td className="py-3.5 px-3">
                      {isCurrent ? (
                        <span className="text-[11px] font-medium text-[#0B7A8A] font-label">Current Reference</span>
                      ) : (
                        <span
                          className={`text-xs font-semibold tabular-nums font-label ${
                            isCleaner ? 'text-[#2E9E5B]' : 'text-[#D93F3F]'
                          }`}
                        >
                          {bm.deltaAqi > 0 ? `+${bm.deltaAqi}` : bm.deltaAqi} AQI
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {isCurrent ? (
                        <span className="text-xs text-[#0B7A8A] font-label font-medium">Selected</span>
                      ) : (
                        <button
                          onClick={() => onSelectLocation(bm.location)}
                          className="px-2.5 py-1 text-xs text-[#0B7A8A] hover:bg-[#0B7A8A] hover:text-white border border-[#0B7A8A]/30 rounded-lg transition-colors font-label font-medium inline-flex items-center gap-1"
                        >
                          Switch <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
