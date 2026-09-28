import { Link } from "react-router-dom";
import { IPOS, isUpcoming } from "../../data/ipos";
import IpoCard from "../../components/ipo/IpoCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";

export default function UpcomingIpo() {
  usePageMeta(
    "Upcoming IPO — Dates & Price Band",
    "All upcoming IPOs in India with expected price band, lot size and open dates."
  );
  const upcoming = IPOS.filter((i) => isUpcoming(i));

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / Upcoming</p>
      <div className="page__head">
        <p className="page__eyebrow">IPO Center</p>
        <h1>Upcoming IPOs</h1>
        <p>IPOs that haven't opened for subscription yet, in order of open date.</p>
      </div>

      {upcoming.length === 0 ? (
        <p className="ipo-plain">No upcoming IPOs on record right now.</p>
      ) : (
        <div className="ipo-grid">
          {upcoming
            .sort((a, b) => (a.openDate < b.openDate ? -1 : 1))
            .map((ipo) => (
              <IpoCard key={ipo.slug} ipo={ipo} />
            ))}
        </div>
      )}
    </div>
  );
}
