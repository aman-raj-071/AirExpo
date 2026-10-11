import { useState } from 'react';
import { ArrowUpRight, Wind, MapPin, Activity, ArrowRight, Clock3, ShieldCheck, ChevronDown } from 'lucide-react';
import { AqiGlobe } from './AqiGlobe';

const scenarios = [
  { label: 'Good', aqi: 32, color: '#65be91', title: 'A little more time outside.', advice: 'Air quality is favorable. Check local conditions before heading out.', bars: [28, 34, 30, 26, 32, 38, 33, 29, 25, 31, 36, 32] },
  { label: 'Moderate', aqi: 84, color: '#e5bd59', title: 'Find your gentler pace.', advice: 'Sensitive to air pollution? Consider a shorter, easier outdoor session.', bars: [63, 70, 84, 78, 72, 69, 81, 88, 76, 65, 60, 68] },
  { label: 'Unhealthy', aqi: 168, color: '#e98694', title: 'Make room for an indoor day.', advice: 'Reduce prolonged outdoor exertion and look for a cleaner forecast window.', bars: [110, 135, 153, 168, 176, 160, 145, 138, 155, 170, 163, 149] },
];

export function LandingPage({ onEnter, onSignIn }: { onEnter: () => void; onSignIn: () => void }) {
  const [scenario, setScenario] = useState(0);
  const selected = scenarios[scenario];
  return (
    <div className="landing-page landing-brutalist">
      <nav className="landing-nav" aria-label="Main navigation">
        <a href="#" className="landing-brand"><span><Wind size={22} /></span><div>AirExpo<small>YOUR EVERYDAY AIR COMPANION</small></div></a>
        <div className="landing-links"><a href="#how-it-works">How it works</a><a href="#made-for-you">Made for you</a></div>
        <div className="landing-account-actions"><button className="landing-button landing-button-light" onClick={onSignIn}>Sign in / Sign up</button>
          <button className="landing-button landing-button-dark" onClick={onEnter}>Open dashboard <ArrowUpRight size={16} /></button>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <AqiGlobe />
          <div className="landing-hero-content">
            <span className="landing-eyebrow"><span className="landing-live-dot" /> A SMALL CHECK. A BETTER DAY.</span>
            <h1>A little clarity.<br /><em>A breath of fresh air.</em></h1>
            <p>Understand the air around you. Find a better time to head outside, a cleaner route to take, and a little more confidence in your everyday plans.</p>
            <div className="landing-hero-actions"><button className="landing-button landing-button-light" onClick={onEnter}>Explore your air <ArrowRight size={18} /></button><a href="#how-it-works">Take a closer look <ChevronDown size={16} /></a></div>
            <div className="landing-trust"><span><MapPin size={14} /> Your location, your conditions</span><span><ShieldCheck size={14} /> No account needed to explore</span></div>
          </div>
          <div className="landing-preview">
            <div className="landing-preview-top"><span><Wind size={17} /> A window into your day</span><span className="landing-demo-label">INTERACTIVE DEMO</span></div>
            <div className="landing-scenario-tabs" role="group" aria-label="Preview air quality conditions">{scenarios.map((item, index) => <button key={item.label} aria-pressed={scenario === index} onClick={() => setScenario(index)} className={scenario === index ? 'selected' : ''}>{item.label}</button>)}</div>
            <div className="landing-preview-body"><div className="landing-demo-reading"><strong style={{ color: selected.color }}>{selected.aqi}</strong><span>U.S. AQI<br /><b>{selected.label}</b></span></div><div><h2>{selected.title}</h2><p>{selected.advice}</p></div></div>
            <div className="landing-mini-chart" aria-label="Illustrative air quality trend">{selected.bars.map((value, index) => <div key={index} style={{ height: `${value / 2 + 12}px`, background: selected.color }} />)}</div>
            <div className="landing-chart-note"><span>Try a condition above to see the advice change</span><span>Illustrative values</span></div>
          </div>
        </section>
        <section className="landing-section" id="how-it-works">
          <span className="landing-section-label">LESS GUESSWORK. MORE LIVING.</span><h2>Your day, with a clearer outlook.</h2><p className="landing-section-intro">From the first morning walk to the journey home, make sense of changing conditions in one calm place.</p>
          <div className="landing-feature-grid">{[
            { icon: Wind, number: '01', title: 'Know what’s in the air', text: 'See local AQI, pollutant concentrations, and weather together. Understand the numbers at a glance.', action: 'Check local conditions' },
            { icon: Clock3, number: '02', title: 'Find your window', text: 'Explore the hourly forecast and compare conditions before choosing when to run, cycle, or open a window.', action: 'Explore the forecast' },
            { icon: MapPin, number: '03', title: 'Take a cleaner route', text: 'Compare walking and cycling alternatives with modeled pollution estimates along the way.', action: 'Plan your next move' },
          ].map(({ icon: Icon, ...feature }) => <button className="landing-feature" key={feature.number} onClick={onEnter}><div className="landing-feature-top"><Icon size={25} /><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="landing-feature-action">{feature.action}<ArrowUpRight size={17} /></span></button>)}</div>
        </section>
        <section className="landing-personal-section" id="made-for-you"><div><span className="landing-section-label">MADE FOR REAL LIFE</span><h2>Different days.<br /><em>Different needs.</em></h2><p>Whether you’re planning the school run, managing respiratory sensitivity, or training for your next personal best, keep the environment in the picture.</p><button className="landing-button landing-button-dark" onClick={onEnter}>Find your daily outlook <ArrowRight size={17} /></button></div><div className="landing-audience-list">{[
          ['Everyday explorers', 'Local conditions for walks, commutes, and everyday plans.'],
          ['Sensitive breathers', 'Personal profiles and a symptom journal to track your own observations.'],
          ['Outdoor movers', 'Forecast windows and route comparisons for your next session.'],
        ].map(([title, text], index) => <details key={title} open={index === 0 ? true : undefined}><summary><Activity size={19} /><span>{title}</span><ChevronDown size={18} /></summary><p>{text}</p></details>)}</div></section>
        <section className="landing-closing"><span className="landing-section-label">START WITH THE AIR AROUND YOU</span><h2>A better-informed day<br />starts with a breath.</h2><button className="landing-button landing-button-light" onClick={onEnter}>Open AirExpo <ArrowUpRight size={18} /></button><p>Modeled environmental estimates. Planning guidance, not medical advice.</p></section>
      </main>
      <footer className="landing-footer"><a href="#" className="landing-brand">AirExpo</a><span>Built for a little more clarity, every day.</span><span>© 2026 AirExpo</span></footer>
    </div>
  );
}
