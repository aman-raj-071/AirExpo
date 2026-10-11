import { useEffect, useRef } from 'react';

const cities = [
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
];
type Ring = number[][];

export function AqiGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const controller = new AbortController();
    let rings: Ring[] = [];
    let readings: (number | null)[] = cities.map(() => null);
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let rotation = -0.9;
    let lastTime = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    fetch('/assets/globe-land.geojson', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        rings = data.features.flatMap((feature: any) => feature.geometry.type === 'Polygon'
          ? feature.geometry.coordinates.slice(0, 1)
          : feature.geometry.coordinates.map((polygon: Ring[]) => polygon[0]));
      }).catch(() => {});

    const loadReadings = async () => {
      try {
        const params = new URLSearchParams({
          latitude: cities.map((city) => city.lat).join(','),
          longitude: cities.map((city) => city.lon).join(','),
          current: 'us_aqi', timezone: 'auto',
        });
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) readings = cities.map((_, index) => Number.isFinite(data[index]?.current?.us_aqi) ? Math.round(data[index].current.us_aqi) : null);
      } catch { /* Keep unavailable markers honest when the provider is offline. */ }
    };
    void loadReadings();
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(canvas);

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const delta = lastTime ? Math.min(time - lastTime, 50) : 0;
      lastTime = time;
      if (!visible || document.hidden || !width || !height) return;
      if (!reducedMotion.matches) rotation += delta * 0.000045;
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(width * 0.46, 430);
      const cx = width / 2;
      const cy = height * 0.68;
      const project = (lon: number, lat: number) => {
        const latitude = lat * Math.PI / 180;
        const longitude = lon * Math.PI / 180 + rotation;
        const x = Math.cos(latitude) * Math.sin(longitude);
        const y = Math.sin(latitude);
        const z = Math.cos(latitude) * Math.cos(longitude);
        const tilt = -0.22;
        return { x: cx + radius * x, y: cy - radius * (y * Math.cos(tilt) - z * Math.sin(tilt)), z: y * Math.sin(tilt) + z * Math.cos(tilt) };
      };
      const ocean = ctx.createRadialGradient(cx - radius * .3, cy - radius * .5, 0, cx, cy, radius);
      ocean.addColorStop(0, '#34476a'); ocean.addColorStop(1, '#121d36');
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = ocean; ctx.fill();
      ctx.strokeStyle = '#99b9de55'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
      const line = (points: Ring, color: string) => {
        ctx.beginPath(); let started = false;
        for (const [lon, lat] of points) {
          const p = project(lon, lat);
          if (p.z <= 0) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = color; ctx.stroke();
      };
      for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 181 }, (_, i) => [i * 2 - 180, lat]), '#a5c8ed19');
      for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 91 }, (_, i) => [lon, i * 2 - 90]), '#a5c8ed19');
      // Land outlines and city markers share the same spherical projection.
      for (const ring of rings) line(ring, '#adc9e5aa');
      ctx.restore();
      cities.forEach((city, index) => {
        const p = project(city.lon, city.lat);
        if (p.z < .22) return;
        const aqi = readings[index];
        const color = aqi === null ? '#adc3d8' : aqi <= 50 ? '#85e6b0' : aqi <= 100 ? '#ffd451' : aqi <= 150 ? '#ffa965' : '#ff7c98';
        ctx.globalAlpha = Math.min(1, (p.z - .22) * 3);
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.strokeStyle = color + '60'; ctx.stroke();
        const label = `${city.name.toUpperCase()}  ${aqi ?? '—'}`;
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        const labelWidth = ctx.measureText(label).width + 18;
        const x = Math.min(width - labelWidth - 8, Math.max(8, p.x + 13));
        ctx.fillStyle = '#10162fe8'; ctx.fillRect(x, p.y - 14, labelWidth, 27);
        ctx.strokeStyle = color + '90'; ctx.strokeRect(x, p.y - 14, labelWidth, 27);
        ctx.fillStyle = color; ctx.fillText(label, x + 9, p.y + 3);
      });
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); controller.abort(); resize.disconnect(); observer.disconnect(); };
  }, []);

  return <div className="aqi-globe-background" aria-hidden="true"><canvas ref={canvasRef} /><div className="aqi-globe-scrim" /><span className="aqi-globe-caption">GLOBAL AIR SNAPSHOT · MODELED U.S. AQI · OPEN-METEO</span></div>;
}
