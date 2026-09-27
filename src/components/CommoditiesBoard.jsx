import './CommoditiesBoard.css';
const fmt=(n,d=2)=>n==null?'—':Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
export default function CommoditiesBoard({ data }) {
 const items=[['Gold',data?.gold,'$/oz'],['Silver',data?.silver,'$/oz'],['Brent',data?.brent,'$/bbl'],['WTI',data?.wti,'$/bbl'],['Copper',data?.copper,'$/lb']];
 return <section className="section"><div className="section__head"><h2>🌎 Global Market Drivers</h2><p>Commodity and currency reference prices. A dash means the configured free source did not return a value; no stale placeholder is shown.</p></div><div className="commodity-board">{items.map(([name,x,unit])=><article key={name}><span>{name}</span><strong className="num">{x?.price==null?'—':fmt(x.price, name==='Gold'||name==='Silver'?1:2)}</strong><small>{unit} · {x?.asOf ? new Date(x.asOf).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})+' IST' : x?.configured===false?'API key required':'source timestamp unavailable'}</small></article>)}</div></section>;
}
