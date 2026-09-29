import { Link } from "react-router-dom";
import { IPOS, isOpenToday } from "../../data/ipos";
import IpoCard from "../../components/ipo/IpoCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";

export default function TodayIpo() {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  usePageMeta("Today's IPO — Open for Subscription", `IPOs open for subscription today, ${todayStr}: price band, lot size and live subscription figures.`);
  const openToday = IPOS.filter((i) => isOpenToday(i, today));

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/ipo">IPO</Link> / Today</p>
      <div className="page__head">
        <p className="page__eyebrow">IPO Center · {todayStr}</p>
        <h1>Today's IPO</h1>
        <p>IPOs currently open for subscription.</p>
      </div>
      {openToday.length === 0 ? (
        <p className="ipo-plain">No IPO is open for subscription today. Check the <Link to="/ipo/upcoming-ipo">upcoming IPO</Link> page for what's opening next.</p>
      ) : (
        <div className="ipo-grid">{openToday.map((ipo) => <IpoCard key={ipo.slug} ipo={ipo} />)}</div>
      )}
    </div>
  );
}
