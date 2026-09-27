import './MarketIndexStrip.css';
const fmt = (n, digits = 2) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
function Card({ label, row }) { return <div className="index-card"><span>{label}</span><strong className="num">{fmt(row?.price)}</strong><small>{row?.changePercent == null ? 'No provider quote' : <em className={row.changePercent >= 0 ? 'gain':'loss'}>{row.changePercent >= 0 ? '+' : ''}{fmt(row.changePercent)}%</em>}</small></div>; }
export default function MarketIndexStrip({ market }) {
 const q=market?.quotes?.rows||[]; const get=s=>q.find(x=>x.symbol===s);
 return <section className="index-strip"><Card label="NIFTY 50" row={get('NIFTY:NSE')}/><Card label="SENSEX" row={get('SENSEX:BSE')}/><Card label="BANK NIFTY" row={get('NIFTY BANK:NSE')}/><Card label="NASDAQ" row={get('IXIC')}/><Card label="S&P 500" row={get('SPX')}/><Card label="DOW" row={get('DJI')}/></section>;
}
