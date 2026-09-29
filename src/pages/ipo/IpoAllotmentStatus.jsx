import { Link } from "react-router-dom";
import { IPOS } from "../../data/ipos";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";

export default function IpoAllotmentStatus() {
  usePageMeta("IPO Allotment Status — Check by Registrar", "Check your IPO allotment status directly on the registrar's site — Link Intime, KFin Technologies and others.");

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / Allotment status</p>
      <div className="page__head">
        <p className="page__eyebrow">IPO Center</p>
        <h1>IPO Allotment Status</h1>
        <p>Allotment lookup is done per-PAN on the registrar's own site — there's no public API for it. Use the direct links below.</p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Company</th><th>Registrar</th><th>Allotment date</th><th></th></tr></thead>
          <tbody>
            {IPOS.map((ipo) => (
              <tr key={ipo.slug}>
                <td><Link to={`/ipo/${ipo.slug}`}>{ipo.companyName}</Link></td>
                <td>{ipo.registrar.name}</td>
                <td className="num">{ipo.allotmentDate}</td>
                <td><a href={ipo.registrar.allotmentUrl} target="_blank" rel="noreferrer">Check status →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="section" style={{ marginTop: "2.5rem" }}>
        <div className="section__head">
          <h2>Not sure if you'll get allotted?</h2>
          <p>Estimate your odds with the allotment probability tool — it's an estimate, not a prediction.</p>
        </div>
        <Link to="/tools/ipo-allotment-probability" className="ipo-cta">Try the allotment estimator →</Link>
      </section>
    </div>
  );
}
