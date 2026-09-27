import './IPOSection.css';
function daysUntil(date){ if(!date)return null; const d=new Date(date+'T00:00:00'); return Math.ceil((d-new Date())/86400000); }
export default function IPOSection({ data }) {
 const rows=data?.calendar?.rows || data?.india?.rows || [];
 const configured=data?.calendar?.configured || data?.india?.configured;
 return <section className="section"><div className="section__head"><h2>🚀 IPO</h2><p>Upcoming issues, dates, pricing and subscription intelligence. GMP is treated separately as unofficial market-reported data.</p></div>
   {!configured ? <div className="setup-card"><strong>IPO feed not configured yet.</strong><p>IPO data is requested directly from the public IPO feed. Provider-dependent fields such as GMP, lot size and subscription are shown only when returned.</p></div> : <div className="ipo-grid">{rows.slice(0,6).map((r,i)=><a href={`/ipo/${slug(r.company||r.name||r.symbol||`ipo-${i}`)}`} className="ipo-card" key={`${r.symbol||r.company||i}`}><div><span className="ipo-tag">{r.exchange||r.type||'IPO'}</span><b>{r.company||r.name||r.symbol}</b></div><strong>{r.priceRange||r.issue_price||r.price||'Price TBA'}</strong><small>{r.date||r.open_date||r.openDate||'Date TBA'} {daysUntil(r.date)!=null && daysUntil(r.date)>=0 ? `· ${daysUntil(r.date)}d` : ''}</small></a>)}</div>}
   <div className="ipo-links"><a href="/ipo-calendar">IPO Calendar →</a><a href="/gmp">IPO GMP →</a><a href="/ipo-allotment-status">Allotment Status →</a></div>
 </section>;
}
function slug(s){return String(s).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
