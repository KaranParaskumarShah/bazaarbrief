import { Link } from "react-router-dom";
import { IPOS, isOpenToday, isUpcoming } from "../../data/ipos";
import IpoCard from "../../components/ipo/IpoCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";
import "../../styles/ipo-utility-links.css";

const UTILITY_LINKS = [
  { to: "/ipo/today-ipo", label: "Today's IPO" },
  { to: "/ipo/upcoming-ipo", label: "Upcoming IPOs" },
  { to: "/ipo/ipo-calendar", label: "IPO Calendar" },
  { to: "/ipo/gmp", label: "IPO GMP Today" },
  { to: "/ipo/ipo-allotment-status", label: "Allotment Status" },
];

export default function IpoHub() {
  usePageMeta(
    "IPO Center — Live GMP, Dates & Subscription",
    "Track every Indian IPO: price band, dates, lot size, GMP, subscription and allotment status, all in one place."
  );
  const today = new Date();
  const open = IPOS.filter((i) => isOpenToday(i, today) || i.status === "open");
  const upcoming = IPOS.filter((i) => isUpcoming(i, today));
  const others = IPOS.filter((i) => !open.includes(i) && !upcoming.includes(i));

  return (
    <div className="page">
      <div className="page__head">
        <p className="page__eyebrow">IPO Center</p>
        <h1>Every Indian IPO, one page each</h1>
        <p>Price band, dates, lot size, financials, subscription and GMP — structured the same way for every issue so you can compare at a glance.</p>
      </div>

      <div className="ipo-utility-links">
        {UTILITY_LINKS.map((l) => <Link key={l.to} to={l.to} className="ipo-utility-links__item">{l.label}</Link>)}
      </div>

      {open.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Open for subscription</h2></div>
          <div className="ipo-grid">{open.map((ipo) => <IpoCard key={ipo.slug} ipo={ipo} />)}</div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Upcoming</h2></div>
          <div className="ipo-grid">{upcoming.map((ipo) => <IpoCard key={ipo.slug} ipo={ipo} />)}</div>
        </section>
      )}
      {others.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Recently closed / listed</h2></div>
          <div className="ipo-grid">{others.map((ipo) => <IpoCard key={ipo.slug} ipo={ipo} />)}</div>
        </section>
      )}
    </div>
  );
}
