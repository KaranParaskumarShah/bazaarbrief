import { usePolling } from "./hooks/usePolling";
import { fetchUsdInrRate, fetchGoldUsd, fetchBrentUsd } from "./services/api";
import Masthead from "./components/Masthead";
import TickerStrip from "./components/TickerStrip";
import CommoditiesSection from "./components/CommoditiesSection";
import FiiDiiSection from "./components/FiiDiiSection";
import StockCategorySection from "./components/StockCategorySection";
import { STOCK_CATEGORIES } from "./data/stockCategories";
import "./App.css";

export default function App() {
  const fx = usePolling(fetchUsdInrRate, []);
  const gold = usePolling(fetchGoldUsd, []);
  const brent = usePolling(fetchBrentUsd, []);

  const tickerItems = [
    fx.data ? { label: "USD/INR", value: `₹${fx.data.toFixed(2)}` } : null,
    gold.data ? { label: "Gold", value: `$${gold.data.price.toFixed(1)}` } : null,
    brent.data ? { label: "Brent", value: `$${brent.data.price.toFixed(2)}` } : null,
    { label: "Bazaar Brief", value: "Live through the session" },
  ].filter(Boolean);

  return (
    <div className="app">
      <TickerStrip items={tickerItems} />
      <Masthead />

      <main className="app__main">
        <CommoditiesSection />
        <FiiDiiSection />

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
    </div>
  );
}
