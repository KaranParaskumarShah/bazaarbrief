import { usePolling } from "../hooks/usePolling";
import { fetchStockQuote, hasKey } from "../services/api";
import "./IndexTile.css";

export default function IndexTile({ symbol, label }) {
  const { data, loading, error } = usePolling(() => fetchStockQuote(symbol), [symbol]);
  const configured = hasKey("TWELVE_DATA_KEY");

  return (
    <div className="itile">
      <span className="itile__label">{label}</span>
      {!configured ? (
        <span className="itile__hint">Needs TWELVE_DATA_KEY</span>
      ) : loading && !data ? (
        <span className="itile__hint">Loading…</span>
      ) : error || data?.error ? (
        <span className="itile__hint">No data</span>
      ) : (
        <div className="itile__row">
          <span className="num itile__price">{data.price?.toLocaleString("en-IN")}</span>
          <span className={`num itile__change ${data.changePercent >= 0 ? "gain" : "loss"}`}>
            {data.changePercent >= 0 ? "+" : ""}
            {data.changePercent?.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
