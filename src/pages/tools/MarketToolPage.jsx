import { Link, Navigate } from "react-router-dom";
import { getMarketToolBySlug } from "../../data/marketTools";
import { fetchUsdInrRate, fetchStockQuote, hasKey } from "../../services/api";
import { usePolling } from "../../hooks/usePolling";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useState } from "react";
import "../../styles/pages.css";
import "./ToolPage.css";

function CommodityTool({ tool, rate }) {
  const state = usePolling(tool.fetcher, [tool.slug]);
  const usd = state.data?.price;
  const inr = usd != null && rate ? usd * rate : null;
  return (
    <div className="tool-live-card">
      {state.loading && usd == null ? (
        <p>Fetching…</p>
      ) : state.error ? (
        <p className="loss">Couldn't load this price. {state.error}</p>
      ) : (
        <>
          <span className="tool-result__label">{tool.unit}</span>
          <div className="tool-live-card__prices">
            <span className="num big">${usd?.toFixed(2)}</span>
            <span className="num big gain">₹{inr?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </>
      )}
    </div>
  );
}

function CommodityDualTool({ tool, rate }) {
  const a = usePolling(tool.fetcherA.fn, [tool.slug, "a"]);
  const b = usePolling(tool.fetcherB.fn, [tool.slug, "b"]);
  const rows = [
    { label: tool.fetcherA.label, state: a },
    { label: tool.fetcherB.label, state: b },
  ];
  return (
    <div className="tool-live-card" style={{ maxWidth: 560 }}>
      {rows.map((r) => {
        const usd = r.state.data?.price;
        const inr = usd != null && rate ? usd * rate : null;
        return (
          <div key={r.label} style={{ marginBottom: "1rem" }}>
            <span className="tool-result__label">{r.label} — {tool.unit}</span>
            <div className="tool-live-card__prices">
              {r.state.loading && usd == null ? (
                <span>Fetching…</span>
              ) : r.state.error ? (
                <span className="loss">Unavailable</span>
              ) : (
                <>
                  <span className="num big">${usd?.toFixed(2)}</span>
                  <span className="num big gain">₹{inr?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndexTool({ tool }) {
  const state = usePolling(() => fetchStockQuote(tool.symbol), [tool.slug]);
  const configured = hasKey("TWELVE_DATA_KEY");
  return (
    <div className="tool-live-card">
      {!configured ? (
        <>
          <p>Live index value needs a free API key.</p>
          <code style={{ fontFamily: "var(--font-num)", fontSize: "0.8rem" }}>
            src/config.js → TWELVE_DATA_KEY
          </code>
        </>
      ) : state.loading && !state.data ? (
        <p>Fetching…</p>
      ) : state.error || state.data?.error ? (
        <p className="loss">Couldn't load this index.</p>
      ) : (
        <div className="tool-live-card__prices">
          <span className="num big">{state.data.price?.toLocaleString("en-IN")}</span>
          <span className={`num big ${state.data.changePercent >= 0 ? "gain" : "loss"}`}>
            {state.data.changePercent >= 0 ? "+" : ""}
            {state.data.changePercent?.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}

function ConverterTool() {
  const fx = usePolling(fetchUsdInrRate, []);
  const [usd, setUsd] = useState(100);

  return (
    <div className="tool-converter">
      <div className="tool-converter__field">
        <span>US Dollars</span>
        <input type="number" value={usd} onChange={(e) => setUsd(e.target.value)} />
      </div>
      <span className="tool-converter__result">
        {fx.data ? `₹${(parseFloat(usd || 0) * fx.data).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "…"}
      </span>
      {fx.data && <span className="tool-result__label">at ₹{fx.data.toFixed(2)} / $</span>}
    </div>
  );
}

export default function MarketToolPage({ slug }) {
  const tool = getMarketToolBySlug(slug);
  const rateState = usePolling(fetchUsdInrRate, []);
  usePageMeta(tool?.title, tool?.description);

  if (!tool) return <Navigate to="/tools" replace />;

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/tools">Tools</Link> / {tool.category} / {tool.title}</p>
      <div className="page__head">
        <p className="page__eyebrow">{tool.category}</p>
        <h1>{tool.title}</h1>
        <p>{tool.description}</p>
      </div>

      {tool.kind === "converter" && <ConverterTool />}
      {tool.kind === "commodity" && <CommodityTool tool={tool} rate={rateState.data} />}
      {tool.kind === "commodity-dual" && <CommodityDualTool tool={tool} rate={rateState.data} />}
      {tool.kind === "index" && <IndexTool tool={tool} />}
      {tool.kind === "unavailable" && (
        <div className="disclaimer-box" style={{ maxWidth: 560 }}>
          <strong>Not wired up yet.</strong> {tool.note}
        </div>
      )}
    </div>
  );
}
