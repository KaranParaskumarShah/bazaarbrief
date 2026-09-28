import { Link } from "react-router-dom";
import "./IpoCard.css";

const STATUS_LABEL = {
  open: "Open now",
  upcoming: "Upcoming",
  closed: "Closed — allotment pending",
  listed: "Listed",
};

export default function IpoCard({ ipo }) {
  return (
    <Link to={`/ipo/${ipo.slug}`} className="ipocard">
      <div className="ipocard__top">
        <span className={`ipocard__status ipocard__status--${ipo.status}`}>
          {STATUS_LABEL[ipo.status]}
        </span>
        <span className="ipocard__sector">{ipo.sector}</span>
      </div>
      <h3 className="ipocard__name">{ipo.companyName}</h3>
      <div className="ipocard__stats">
        <div>
          <span className="ipocard__label">Price band</span>
          <span className="num">₹{ipo.priceBand.min}–{ipo.priceBand.max}</span>
        </div>
        <div>
          <span className="ipocard__label">Lot size</span>
          <span className="num">{ipo.lotSize} shares</span>
        </div>
        <div>
          <span className="ipocard__label">GMP</span>
          <span className="num gain">+₹{ipo.gmp.value}</span>
        </div>
      </div>
      <div className="ipocard__dates">
        <span>{ipo.openDate} → {ipo.closeDate}</span>
        <span>Listing {ipo.listingDate}</span>
      </div>
    </Link>
  );
}
