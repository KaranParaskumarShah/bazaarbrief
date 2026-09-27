import './InstitutionalActivity.css';
const cr = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})} Cr`;
export default function InstitutionalActivity({ data }) {
  const latest = data?.rows?.[0];
  if (!latest) return <section className="section"><div className="section__head"><h2>FII / DII Activity</h2><p>No verified institutional-flow snapshot is available.</p></div></section>;
  return <section className="section"><div className="section__head"><h2>FII / DII Activity</h2><p>Provisional cash-market institutional flow. Latest available row: <span className="num">{latest.date}</span>.</p></div><div className="institutional-grid"><div><span>FII Net</span><b className={`num ${latest.fiiNet >= 0 ? 'gain' : 'loss'}`}>{cr(latest.fiiNet)}</b></div><div><span>DII Net</span><b className={`num ${latest.diiNet >= 0 ? 'gain' : 'loss'}`}>{cr(latest.diiNet)}</b></div><div><span>Combined Net</span><b className={`num ${latest.fiiNet + latest.diiNet >= 0 ? 'gain' : 'loss'}`}>{cr(latest.fiiNet + latest.diiNet)}</b></div></div></section>;
}
