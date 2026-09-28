import "./CommodityCard.css";

const fmt = (n, digits = 2) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function CommodityCard({ name, unit, state, priceUsd, priceInr, keyName }) {
  const { loading, error } = state;
  const needsKey = state.data === null && !loading && !error && keyName;

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
      ) : error ? (
        <div className="ccard__empty ccard__empty--error">
          <p>Couldn't load this price.</p>
          <span>{error}</span>
        </div>
      ) : loading && priceUsd == null ? (
        <div className="ccard__loading">Fetching…</div>
      ) : (
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
      )}
    </article>
  );
}
