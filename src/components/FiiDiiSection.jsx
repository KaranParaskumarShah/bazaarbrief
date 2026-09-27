import './FiiDiiSection.css';

const fmtCr = (n) => `${n >= 0 ? '+' : ''}${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export default function FiiDiiSection({ data }) {
  const rows = [...(data?.rows || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = rows[0];
  const maxAbs = Math.max(...rows.flatMap((r) => [Math.abs(r.fiiNet), Math.abs(r.diiNet)]), 1);

  return (
    <section className="section">
      <div className="section__head">
        <h2>FII / DII Activity</h2>
        <p>
          Provisional cash-market net flows. Latest available entry: <span className="num">{data?.lastUpdated || '—'}</span> · {data?.provider || 'Published market data'}.
        </p>
      </div>
      {latest ? <div className="fd-summary">
        <div className="fd-summary__item"><span className="fd-summary__label">FII net — {latest.date}</span><span className={`fd-summary__value num ${latest.fiiNet >= 0 ? 'gain' : 'loss'}`}>{fmtCr(latest.fiiNet)} Cr</span></div>
        <div className="fd-summary__item"><span className="fd-summary__label">DII net — {latest.date}</span><span className={`fd-summary__value num ${latest.diiNet >= 0 ? 'gain' : 'loss'}`}>{fmtCr(latest.diiNet)} Cr</span></div>
      </div> : <div className="setup-card"><strong>FII/DII data unavailable.</strong><p>No fabricated values are shown.</p></div>}
      <div className="fd-table">
        <div className="fd-table__row fd-table__row--head"><span>Date</span><span>FII net</span><span>DII net</span></div>
        {rows.map((r) => <div className="fd-table__row" key={r.date}>
          <span className="fd-date">{r.date}</span>
          <span className="fd-bar-cell"><span className={`fd-bar ${r.fiiNet >= 0 ? 'fd-bar--gain' : 'fd-bar--loss'}`} style={{ width: `${(Math.abs(r.fiiNet) / maxAbs) * 100}%` }} /><span className={`num ${r.fiiNet >= 0 ? 'gain' : 'loss'}`}>{fmtCr(r.fiiNet)}</span></span>
          <span className="fd-bar-cell"><span className={`fd-bar ${r.diiNet >= 0 ? 'fd-bar--gain' : 'fd-bar--loss'}`} style={{ width: `${(Math.abs(r.diiNet) / maxAbs) * 100}%` }} /><span className={`num ${r.diiNet >= 0 ? 'gain' : 'loss'}`}>{fmtCr(r.diiNet)}</span></span>
        </div>)}
      </div>
    </section>
  );
}
