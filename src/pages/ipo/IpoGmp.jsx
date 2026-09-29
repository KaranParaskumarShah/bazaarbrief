import { Link } from "react-router-dom";
import { IPOS } from "../../data/ipos";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";

export default function IpoGmp() {
  usePageMeta("IPO GMP Today — Grey Market Premium", "Latest grey market premium (GMP) for open and upcoming IPOs. Unofficial, market-reported figures — not exchange data.");
  const rows = [...IPOS].sort((a, b) => b.gmp.value - a.gmp.value);

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / GMP</p>
      <div className="page__head">
        <p className="page__eyebrow">IPO Center</p>
        <h1>IPO GMP Today</h1>
        <p>Grey market premium tracked against each IPO's price band.</p>
      </div>
      <div className="disclaimer-box">
        <strong>GMP is unofficial.</strong> It's grey-market chatter reported by broker networks and IPO forums, not an NSE/BSE figure. It moves daily, can vanish before listing, and is not a reliable predictor of listing-day price.
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Company</th><th>Price band</th><th>GMP</th><th>Est. listing gain</th><th>As of</th></tr></thead>
          <tbody>
            {rows.map((ipo) => (
              <tr key={ipo.slug}>
                <td><Link to={`/ipo/${ipo.slug}`}>{ipo.companyName}</Link></td>
                <td className="num">₹{ipo.priceBand.min}–{ipo.priceBand.max}</td>
                <td className="num gain">+₹{ipo.gmp.value}</td>
                <td className="num gain">{((ipo.gmp.value / ipo.priceBand.max) * 100).toFixed(1)}%</td>
                <td className="num">{ipo.gmp.asOf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
