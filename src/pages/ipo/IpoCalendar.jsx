import { Link } from "react-router-dom";
import { IPOS } from "../../data/ipos";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";

export default function IpoCalendar() {
  usePageMeta(
    "IPO Calendar — Open & Close Dates",
    "Full calendar of Indian IPOs with open date, close date, allotment date and listing date."
  );

  const rows = [...IPOS].sort((a, b) => (a.openDate < b.openDate ? -1 : 1));

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / Calendar</p>
      <div className="page__head">
        <p className="page__eyebrow">IPO Center</p>
        <h1>IPO Calendar</h1>
        <p>Every tracked IPO's full timeline in one table.</p>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Open</th>
              <th>Close</th>
              <th>Allotment</th>
              <th>Listing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ipo) => (
              <tr key={ipo.slug}>
                <td><Link to={`/ipo/${ipo.slug}`}>{ipo.companyName}</Link></td>
                <td className="num">{ipo.openDate}</td>
                <td className="num">{ipo.closeDate}</td>
                <td className="num">{ipo.allotmentDate}</td>
                <td className="num">{ipo.listingDate}</td>
                <td style={{ textTransform: "capitalize" }}>{ipo.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
