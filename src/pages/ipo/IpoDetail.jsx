import { useParams, Link, Navigate } from "react-router-dom";
import { getIpoBySlug } from "../../data/ipos";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";
import "./IpoDetail.css";

const fmtCr = (n) => `₹${n.toLocaleString("en-IN")} Cr`;

export default function IpoDetail() {
  const { slug } = useParams();
  const ipo = getIpoBySlug(slug);

  usePageMeta(
    ipo ? `${ipo.companyName} IPO — Price, Dates, GMP & Review` : "IPO not found",
    ipo ? `${ipo.companyName} IPO: price band ₹${ipo.priceBand.min}-${ipo.priceBand.max}, opens ${ipo.openDate}, closes ${ipo.closeDate}. Lot size, GMP, financials, subscription and allotment details.` : undefined
  );

  if (!ipo) return <Navigate to="/ipo" replace />;

  const minInvestment = ipo.lotSize * ipo.priceBand.max;

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / {ipo.companyName}</p>
      <div className="page__head">
        <p className="page__eyebrow">{ipo.sector} · {ipo.exchange}</p>
        <h1>{ipo.companyName} IPO</h1>
        <p>Opens {ipo.openDate}, closes {ipo.closeDate}. Price band ₹{ipo.priceBand.min}–{ipo.priceBand.max}, lot size {ipo.lotSize} shares.</p>
      </div>

      <div className="disclaimer-box">
        <strong>Sample data.</strong> This page is wired up with placeholder figures so the layout works end to end. Replace every field in <code>src/data/ipos.js</code> with figures sourced from the company's RHP and NSE/BSE circulars before publishing.
      </div>

      <div className="ipo-key-grid">
        <div className="ipo-key"><span className="ipo-key__label">Price band</span><span className="num ipo-key__value">₹{ipo.priceBand.min} – ₹{ipo.priceBand.max}</span></div>
        <div className="ipo-key"><span className="ipo-key__label">Lot size</span><span className="num ipo-key__value">{ipo.lotSize} shares</span></div>
        <div className="ipo-key"><span className="ipo-key__label">Min. investment</span><span className="num ipo-key__value">₹{minInvestment.toLocaleString("en-IN")}</span></div>
        <div className="ipo-key"><span className="ipo-key__label">Issue size</span><span className="num ipo-key__value">{fmtCr(ipo.issueSize)}</span></div>
        <div className="ipo-key"><span className="ipo-key__label">Fresh issue</span><span className="num ipo-key__value">{fmtCr(ipo.freshIssue)}</span></div>
        <div className="ipo-key"><span className="ipo-key__label">Offer for sale</span><span className="num ipo-key__value">{ipo.ofs ? fmtCr(ipo.ofs) : "—"}</span></div>
        <div className="ipo-key ipo-key--gmp">
          <span className="ipo-key__label">GMP (unofficial)</span>
          <span className="num ipo-key__value gain">+₹{ipo.gmp.value}</span>
          <span className="ipo-key__hint">as of {ipo.gmp.asOf} — {ipo.gmp.note}</span>
        </div>
        <div className="ipo-key"><span className="ipo-key__label">Est. listing gain</span><span className="num ipo-key__value gain">{((ipo.gmp.value / ipo.priceBand.max) * 100).toFixed(1)}%</span></div>
      </div>

      <section className="section">
        <div className="section__head"><h2>Important dates</h2></div>
        <div className="table-wrap">
          <table className="data-table"><tbody>
            <tr><td>IPO opens</td><td className="num">{ipo.openDate}</td></tr>
            <tr><td>IPO closes</td><td className="num">{ipo.closeDate}</td></tr>
            <tr><td>Basis of allotment</td><td className="num">{ipo.allotmentDate}</td></tr>
            <tr><td>Refunds initiated</td><td className="num">{ipo.refundDate}</td></tr>
            <tr><td>Shares credited to demat</td><td className="num">{ipo.demalDate}</td></tr>
            <tr><td>Listing date</td><td className="num">{ipo.listingDate}</td></tr>
            {ipo.listingPrice && <tr><td>Listing price</td><td className="num">₹{ipo.listingPrice}</td></tr>}
          </tbody></table>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Financials</h2><p>All figures in ₹ crore.</p></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Revenue</th><th>Profit</th><th>Debt</th></tr></thead>
            <tbody>{ipo.financials.map((f) => (
              <tr key={f.year}><td>{f.year}</td><td className="num">₹{f.revenueCr.toLocaleString("en-IN")} Cr</td><td className="num gain">₹{f.profitCr.toLocaleString("en-IN")} Cr</td><td className="num">₹{f.debtCr.toLocaleString("en-IN")} Cr</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Subscription status</h2><p>As of {ipo.subscription.asOf}.</p></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Category</th><th>Times subscribed</th></tr></thead>
            <tbody>
              <tr><td>Qualified Institutional Buyers (QIB)</td><td className="num">{ipo.subscription.qibTimes ?? "—"}{ipo.subscription.qibTimes ? "x" : ""}</td></tr>
              <tr><td>Non-Institutional Investors (NII)</td><td className="num">{ipo.subscription.niiTimes ?? "—"}{ipo.subscription.niiTimes ? "x" : ""}</td></tr>
              <tr><td>Retail Individual Investors (RII)</td><td className="num">{ipo.subscription.retailTimes ?? "—"}{ipo.subscription.retailTimes ? "x" : ""}</td></tr>
              <tr><td><strong>Overall</strong></td><td className="num"><strong>{ipo.subscription.totalTimes ?? "—"}{ipo.subscription.totalTimes ? "x" : ""}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Promoters</h2></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Pre-issue holding</th></tr></thead>
            <tbody>{ipo.promoters.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{p.holdingPct}%</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Objects of the issue</h2></div>
        <ul className="ipo-list">{ipo.objectsOfIssue.map((o) => <li key={o}>{o}</li>)}</ul>
      </section>

      <section className="section">
        <div className="section__head"><h2>Allotment status</h2></div>
        <p className="ipo-plain">Registrar: <strong>{ipo.registrar.name}</strong>. Check your allotment directly on the registrar's site with your PAN or application number.</p>
        <a className="ipo-cta" href={ipo.registrar.allotmentUrl} target="_blank" rel="noreferrer">Check allotment status →</a>
      </section>

      <section className="section">
        <div className="section__head"><h2>Important documents</h2></div>
        <ul className="ipo-list">{ipo.documents.map((d) => <li key={d.label}><a href={d.url} target="_blank" rel="noreferrer">{d.label}</a></li>)}</ul>
      </section>

      <section className="section">
        <div className="section__head"><h2>Latest news</h2></div>
        <div className="ipo-news">
          {ipo.news.map((n) => (
            <div className="ipo-news__item" key={n.title}>
              <span className="ipo-news__date">{n.date}</span>
              <h4>{n.title}</h4>
              <p>{n.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
