import { useId } from 'react';

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export function MountainBackdrop({ period }: { period: DayPeriod }) {
  const id = useId().replace(/:/g, '');
  const palettes = {
    morning: { sky: '#ffe7b5', horizon: '#fff5df', far: '#c6b9b2', near: '#a2adb4', front: '#859c9f', sun: '#ffbb60', x: 830, y: 133 },
    afternoon: { sky: '#d4edfa', horizon: '#fff6cf', far: '#bbcdd5', near: '#9eb9c4', front: '#7e9fae', sun: '#ffcf4d', x: 865, y: 88 },
    evening: { sky: '#e6d2ed', horizon: '#ffc5a1', far: '#c6a7bc', near: '#a38da9', front: '#827e9f', sun: '#f39467', x: 860, y: 158 },
    night: { sky: '#c1cde4', horizon: '#e0e5f0', far: '#a0b1cc', near: '#879dbb', front: '#728ba7', sun: '#fff8db', x: 865, y: 65 },
  };
  const p = palettes[period];
  return <div className={`mountain-backdrop mountain-backdrop-${period}`} aria-hidden="true">
    <svg viewBox="0 0 1200 270" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={p.sky} /><stop offset="1" stopColor={p.horizon} /></linearGradient>
        <radialGradient id={`${id}-glow`}><stop stopColor={p.sun} stopOpacity=".65" /><stop offset="1" stopColor={p.sun} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-fade`}><stop stopColor="white" stopOpacity=".97" /><stop offset=".48" stopColor="white" stopOpacity=".7" /><stop offset="1" stopColor="white" stopOpacity=".08" /></linearGradient>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h1200v270H0z" />
      {period === 'night' ? <>
        {[[650,30],[720,72],[960,35],[1015,90],[1100,45],[785,20],[1150,115],[600,90]].map(([x,y]) => <path key={x} d={`M${x} ${y-3}v6m-3-3h6`} stroke="#fff" strokeWidth="1.5" opacity=".8" />)}
        <circle cx={p.x} cy={p.y} r="57" fill={`url(#${id}-glow)`} />
        <path d={`M${p.x+12} ${p.y-24}a28 28 0 1 0 11 46 25 25 0 0 1-11-46Z`} fill={p.sun} />
      </> : <>
        <circle cx={p.x} cy={p.y} r={period === 'afternoon' ? 125 : 90} fill={`url(#${id}-glow)`} />
        <circle cx={p.x} cy={p.y} r={period === 'afternoon' ? 32 : 28} fill={p.sun} />
        {period === 'afternoon' && Array.from({length: 12}, (_, index) => <path key={index} d={`M${p.x} ${p.y-45}v-10`} transform={`rotate(${index*30} ${p.x} ${p.y})`} stroke={p.sun} strokeWidth="2" opacity=".65" />)}
      </>}
      <path d="M0 224 125 153 216 192 342 98 446 181 554 122 668 182 773 96 861 171 970 104 1095 180 1200 125V270H0Z" fill={p.far} />
      <path d="m309 131 33-33 42 34-31-10-11 12-12-10Zm438-8 26-27 29 25-20-8-9 10-8-9Zm195 10 28-29 37 30-26-9-11 9-9-9Z" fill="#fff" opacity=".5" />
      <path d="M0 259 144 197 260 233 397 165 520 228 653 152 771 235 889 174 1023 232 1130 165 1200 193V270H0Z" fill={p.near} />
      <path d="M0 265Q170 224 315 261T625 249T940 246T1200 252V270H0Z" fill={p.front} />
      <path fill={`url(#${id}-fade)`} d="M0 0h1200v270H0z" />
    </svg>
  </div>;
}
