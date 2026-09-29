import { useEffect, useState } from "react";
import "./Masthead.css";

export default function Masthead() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <header className="masthead">
      <div className="masthead__row">
        <div className="masthead__mark">
          <span className="masthead__mark-bazaar">Bazaar</span>
          <span className="masthead__mark-brief">Brief</span>
        </div>
        <div className="masthead__meta">
          <span>{dateStr}</span>
          <span className="masthead__dot">·</span>
          <span className="num">{timeStr} IST</span>
        </div>
      </div>
      <p className="masthead__tagline">
        Commodities, currency conversion, IPO tracking and stock calculators for the Indian
        market — one page, updated through the session.
      </p>
    </header>
  );
}
