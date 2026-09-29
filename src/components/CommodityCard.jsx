import { formatRelativeTime } from "../utils/time";
import "./CommodityCard.css";

const fmt = (n, digits = 2) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function CommodityCard({ name, unit, state, priceUsd, priceInr, keyName }) {
  const { loading, error, fetchedAt, stale } = state;
  const needsKey = state.data === null && !loading && !error && keyName;
  const neverLoaded = priceUsd == null && !needsKey;

  return (
    <article className="ccard">
      <div className="ccard__head">
        <h3>{name}</h3>
        <span className="ccard__unit">{unit}</span>
      </div>

      {needsKey ? (
        <div className="ccard__empty">
          <p>Live price needs a free API key.</p>
          <code>src/config.js → {keyName}</code>
        </div>
      ) : neverLoaded && loading ? (
        <div className="ccard__loading">Fetching…</div>
      ) : neverLoaded && error ? (
        <div className="ccard__empty ccard__empty--error">
          <p>Couldn't load this price.</p>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="ccard__prices">
            <div className="ccard__price">
              <span className="ccard__currency">$</span>
              <span className="num">{fmt(priceUsd)}</span>
            </div>
            <div className="ccard__price ccard__price--secondary">
              <span className="ccard__currency">₹</span>
              <span className="num">{fmt(priceInr, priceInr > 10000 ? 0 : 2)}</span>
            </div>
          </div>
          <span className={`ccard__freshness${error ? " ccard__freshness--error" : ""}`}>
            {error ? "Couldn't refresh — showing last saved price" : stale ? "Refreshing…" : `Updated ${formatRelativeTime(fetchedAt)}`}
          </span>
        </>
      )}
    </article>
  );
}
