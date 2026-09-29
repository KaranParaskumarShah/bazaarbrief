import { Link } from "react-router-dom";
import { CALCULATORS } from "../../data/calculators";
import { MARKET_TOOLS } from "../../data/marketTools";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";
import "./ToolsHub.css";

const CATEGORIES = ["Stock Tools", "IPO Tools", "Market Tools"];

export default function ToolsHub() {
  usePageMeta(
    "Financial Tools — SIP, CAGR, IPO & Market Calculators",
    "Free calculators for investors: SIP, CAGR, P/E, EPS, ROE, IPO lot size and profit, plus live gold, silver and crude prices."
  );
  const all = [...CALCULATORS, ...MARKET_TOOLS];

  return (
    <div className="page">
      <div className="page__head">
        <p className="page__eyebrow">Tools</p>
        <h1>Financial Tools</h1>
        <p>Quick calculators for stocks and IPOs, plus live prices for the numbers that move daily.</p>
      </div>
      {CATEGORIES.map((cat) => {
        const items = all.filter((i) => i.category === cat);
        return (
          <section className="section" key={cat}>
            <div className="section__head"><h2>{cat}</h2></div>
            <div className="tools-grid">
              {items.map((tool) => (
                <Link key={tool.slug} to={`/tools/${tool.slug}`} className="tools-grid__item">
                  <span className="tools-grid__title">{tool.title}</span>
                  <span className="tools-grid__desc">{tool.description}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
