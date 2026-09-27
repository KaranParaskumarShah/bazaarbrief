import { useEffect, useState } from 'react';
import './Masthead.css';

const links = [
  ['/', 'Market'], ['/ipo', 'IPO'], ['/ipo-calendar', 'IPO Calendar'], ['/gmp', 'GMP'], ['/tools', 'Tools'],
];

export default function Masthead({ updatedAt, cacheAge, loading, onRefresh }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
  const updated = updatedAt ? new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
  const age = cacheAge == null ? '—' : cacheAge < 60000 ? 'just now' : `${Math.floor(cacheAge / 3600000)}h ${Math.floor((cacheAge % 3600000) / 60000)}m ago`;
  return <header className="masthead">
    <div className="masthead__row">
      <a className="masthead__mark" href="/" aria-label="Bazaar Brief home"><span>Bazaar</span><b>Brief</b></a>
      <div className="masthead__meta"><span>{date}</span><span>·</span><span className="num">{time} IST</span></div>
    </div>
    <nav className="nav" aria-label="Primary navigation">
      {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
    </nav>
    <div className="masthead__status"><span className="live-dot" /> Browser refresh: <b>2 hours</b> · Last successful fetch: <span className="num">{updated} IST</span> · {age} <button type="button" className="refresh-button" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh now'}</button></div>
    <p className="masthead__tagline">Indian markets, IPO intelligence, global drivers and practical financial tools — in one morning brief.</p>
  </header>;
}
