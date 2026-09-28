import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { fetchUsdInrRate, fetchGoldUsd, fetchBrentUsd } from "../services/api";
import Masthead from "../components/Masthead";
import TickerStrip from "../components/TickerStrip";
import IndexTile from "../components/IndexTile";
import CommoditiesSection from "../components/CommoditiesSection";
import FiiDiiSection from "../components/FiiDiiSection";
import StockCategorySection from "../components/StockCategorySection";
import IpoCard from "../components/ipo/IpoCard";
import { STOCK_CATEGORIES } from "../data/stockCategories";
import { IPOS, isOpenToday, isUpcoming } from "../data/ipos";
import { INDIAN_INDICES, GLOBAL_INDICES } from "../data/globalIndices";
import marketHighlights from "../data/marketHighlights.json";
import newsItems from "../data/newsItems.json";
import { usePageMeta } from "../hooks/usePageMeta";
import "../App.css";
import "../styles/pages.css";
import "../styles/ipo-utility-links.css";
import "./Home.css";

export default function Home() {
  usePageMeta(
    undefined,
    "Commodities, FII/DII flows, IPO tracking and sector-wise Indian stocks — updated through the session."
  );

  const fx = usePolling(fetchUsdInrRate, []);
  const gold = usePolling(fetchGoldUsd, []);
  const brent = usePolling(fetchBrentUsd, []);

  const tickerItems = [
    fx.data ? { label: "USD/INR", value: `₹${fx.data.toFixed(2)}` } : null,
    gold.data ? { label: "Gold", value: `$${gold.data.price.toFixed(1)}` } : null,
    brent.data ? { label: "Brent", value: `$${brent.data.price.toFixed(2)}` } : null,
    { label: "Bazaar Brief", value: "Live through the session" },
  ].filter(Boolean);

  const ipoOpen = IPOS.filter((i) => isOpenToday(i) || i.status === "open");
  const ipoUpcoming = IPOS.filter((i) => isUpcoming(i));
  const ipoTeaser = [...ipoOpen, ...ipoUpcoming].slice(0, 3);

  return (
    <>
      <TickerStrip items={tickerItems} />
      <Masthead />

      <main className="app__main">
        {/* Indian market */}
        <section className="section">
          <div className="section__head">
            <h2>Indian Market</h2>
          </div>
          <div className="index-strip">
            {INDIAN_INDICES.map((i) => (
              <IndexTile key={i.symbol} symbol={i.symbol} label={i.label} />
            ))}
          </div>
        </section>

        {/* Today's market */}
        <section className="section">
          <div className="section__head">
            <h2>Today's Market</h2>
            <p>Updated by hand each morning — last edited {marketHighlights.lastUpdated}.</p>
          </div>
          <ul className="highlight-list">
            {marketHighlights.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <FiiDiiSection />
        </section>

        {/* IPO teaser */}
        <section className="section">
          <div className="section__head">
            <h2>IPO</h2>
            <p>Open and upcoming issues. Full details, GMP and calendar in the IPO Center.</p>
          </div>
          {ipoTeaser.length > 0 && (
            <div className="ipo-grid" style={{ marginBottom: "1rem" }}>
              {ipoTeaser.map((ipo) => (
                <IpoCard key={ipo.slug} ipo={ipo} />
              ))}
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

        {/* Global market */}
        <section className="section">
          <div className="section__head">
            <h2>Global Market</h2>
            <p>US indices and the commodities that move Indian markets overnight.</p>
          </div>
          <div className="index-strip" style={{ marginBottom: "0.85rem" }}>
            {GLOBAL_INDICES.map((i) => (
              <IndexTile key={i.symbol} symbol={i.symbol} label={i.label} />
            ))}
          </div>
          <CommoditiesSection />
        </section>

        {/* Latest news */}
        <section className="section">
          <div className="section__head">
            <h2>Latest News</h2>
            <p>Updated by hand — see the note in <code>src/data/newsItems.json</code> for wiring up a live feed.</p>
          </div>
          <div className="news-grid">
            {newsItems.items.map((n) => (
              <Link to={n.url} className="news-card" key={n.title}>
                <span className="news-card__date">{n.date}</span>
                <h4>{n.title}</h4>
                <p>{n.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Financial tools teaser */}
        <section className="section">
          <div className="section__head">
            <h2>Financial Tools</h2>
            <p>SIP, CAGR, IPO and market calculators — free, no signup.</p>
          </div>
          <div className="ipo-utility-links">
            <Link to="/tools/sip-calculator" className="ipo-utility-links__item">SIP</Link>
            <Link to="/tools/cagr-calculator" className="ipo-utility-links__item">CAGR</Link>
            <Link to="/tools/ipo-investment-calculator" className="ipo-utility-links__item">IPO Investment</Link>
            <Link to="/tools/pe-calculator" className="ipo-utility-links__item">P/E</Link>
            <Link to="/tools" className="ipo-utility-links__item">All tools →</Link>
          </div>
        </section>

        {/* Sector watch */}
        <section className="section">
          <div className="section__head">
            <h2>Sector Watch</h2>
            <p>India-listed names grouped by theme — for tracking, not advice.</p>
          </div>
          {STOCK_CATEGORIES.map((cat) => (
            <StockCategorySection key={cat.id} category={cat} />
          ))}
        </section>
      </main>

      <footer className="app__footer">
        <p>
          bazaarbrief.in — prices are informational, sourced from third-party APIs, and may be
          delayed. Not investment advice.
        </p>
      </footer>
    </>
  );
}
