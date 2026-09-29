import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { fetchUsdInrRate, fetchGoldUsd, fetchBrentUsd } from "../services/api";
import Masthead from "../components/Masthead";
import TickerStrip from "../components/TickerStrip";
import CommoditiesSection from "../components/CommoditiesSection";
import FiiDiiSection from "../components/FiiDiiSection";
import NewsSection from "../components/NewsSection";
import IpoCard from "../components/ipo/IpoCard";
import { CALCULATORS } from "../data/calculators";
import { IPOS, isOpenToday, isUpcoming } from "../data/ipos";
import marketHighlights from "../data/marketHighlights.json";
import { usePageMeta } from "../hooks/usePageMeta";
import "../App.css";
import "../styles/pages.css";
import "../styles/ipo-utility-links.css";
import "./Home.css";

export default function Home() {
  usePageMeta(undefined, "Commodities, FII/DII flows, IPO tracking and stock calculators — updated through the session.");

  const fx = usePolling("fx:usd-inr", fetchUsdInrRate);
  const gold = usePolling("commodity:gold", fetchGoldUsd);
  const brent = usePolling("commodity:brent", fetchBrentUsd);

  const tickerItems = [
    fx.data ? { label: "USD/INR", value: `₹${fx.data.toFixed(2)}` } : null,
    gold.data ? { label: "Gold", value: `$${gold.data.price.toFixed(1)}` } : null,
    brent.data ? { label: "Brent", value: `$${brent.data.price.toFixed(2)}` } : null,
    { label: "Bazaar Brief", value: "Live through the session" },
  ].filter(Boolean);

  const ipoOpen = IPOS.filter((i) => isOpenToday(i) || i.status === "open");
  const ipoUpcoming = IPOS.filter((i) => isUpcoming(i));
  const ipoTeaser = [...ipoOpen, ...ipoUpcoming].slice(0, 3);

  const stockTools = CALCULATORS.filter((c) => c.category === "Stock Tools");
  const ipoTools = CALCULATORS.filter((c) => c.category === "IPO Tools");

  return (
    <>
      <TickerStrip items={tickerItems} />
      <Masthead />

      <main className="app__main">
        <section className="section">
          <div className="section__head">
            <h2>Today's Market</h2>
            <p>Updated by hand each morning — last edited {marketHighlights.lastUpdated}.</p>
          </div>
          <ul className="highlight-list">
            {marketHighlights.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
          <FiiDiiSection />
        </section>

        <section className="section">
          <div className="section__head">
            <h2>IPO</h2>
            <p>Open and upcoming issues. Full details, GMP and calendar in the IPO Center.</p>
          </div>
          {ipoTeaser.length > 0 && (
            <div className="ipo-grid" style={{ marginBottom: "1rem" }}>
              {ipoTeaser.map((ipo) => <IpoCard key={ipo.slug} ipo={ipo} />)}
            </div>
          )}
          <div className="ipo-utility-links">
            <Link to="/ipo" className="ipo-utility-links__item">All IPOs</Link>
            <Link to="/ipo/upcoming-ipo" className="ipo-utility-links__item">Upcoming</Link>
            <Link to="/ipo/gmp" className="ipo-utility-links__item">GMP</Link>
            <Link to="/ipo/ipo-calendar" className="ipo-utility-links__item">Calendar</Link>
            <Link to="/ipo/ipo-allotment-status" className="ipo-utility-links__item">Allotment status</Link>
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2>Global Market</h2>
            <p>Commodities that move Indian markets overnight, in dollars and rupees.</p>
          </div>
          <CommoditiesSection />
        </section>

        <NewsSection />

        <section className="section">
          <div className="section__head">
            <h2>Stock Calculators</h2>
            <p>No signup, no live data needed — pure calculators that always work.</p>
          </div>
          <div className="tools-teaser-grid">
            {stockTools.map((t) => <Link key={t.slug} to={`/tools/${t.slug}`} className="tools-teaser-grid__item">{t.title}</Link>)}
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2>IPO Calculators</h2>
            <p>Work out investment, profit, subscription and allotment odds before you apply.</p>
          </div>
          <div className="tools-teaser-grid">
            {ipoTools.map((t) => <Link key={t.slug} to={`/tools/${t.slug}`} className="tools-teaser-grid__item">{t.title}</Link>)}
          </div>
          <div className="ipo-utility-links" style={{ marginTop: "1rem" }}>
            <Link to="/tools" className="ipo-utility-links__item">All tools →</Link>
          </div>
        </section>
      </main>

      <footer className="app__footer">
        <p>bazaarbrief.in — prices are informational, sourced from third-party APIs, and may be delayed. Not investment advice.</p>
      </footer>
    </>
  );
}
