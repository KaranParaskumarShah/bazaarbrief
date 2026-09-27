import './MarketSnapshot.css';
const fmt = (n, d=2) => n == null ? '—' : Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
function Tile({ title, value, change }) { return <div className="snapshot-card"><span>{title}</span><strong className="num">{value}</strong>{change == null ? null : <em className={change >= 0 ? 'gain' : 'loss'}>{change >= 0 ? '+' : ''}{fmt(change)}%</em>}</div>; }
export default function MarketSnapshot({ data }) {
  const q = data?.quotes?.rows || [];
  const find = (s) => q.find((x) => x.symbol === s);
  return <section className="section"><div className="section__head"><h2>🇮🇳 Today’s Market</h2><p>Large Indian names, institutional flow and market drivers. Quotes show the provider timestamp where available.</p></div>
    <div className="snapshot-grid">
      <Tile title="Reliance" value={`₹${fmt(find('RELIANCE:NSE')?.price)}`} change={find('RELIANCE:NSE')?.changePercent} />
      <Tile title="HDFC Bank" value={`₹${fmt(find('HDFCBANK:NSE')?.price)}`} change={find('HDFCBANK:NSE')?.changePercent} />
      <Tile title="TCS" value={`₹${fmt(find('TCS:NSE')?.price)}`} change={find('TCS:NSE')?.changePercent} />
      <Tile title="Infosys" value={`₹${fmt(find('INFY:NSE')?.price)}`} change={find('INFY:NSE')?.changePercent} />
      <Tile title="Gold" value={`$${fmt(data?.gold?.price,1)}`} />
      <Tile title="Brent" value={`$${fmt(data?.brent?.price)}`} />
    </div>
  </section>;
}
