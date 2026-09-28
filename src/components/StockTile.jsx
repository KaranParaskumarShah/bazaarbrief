import { usePolling } from "../hooks/usePolling";
import { fetchStockQuote, hasKey } from "../services/api";
import "./StockTile.css";

export default function StockTile({ symbol, name, note }) {
  const { data, loading, error } = usePolling(() => fetchStockQuote(symbol), [symbol]);
  const configured = hasKey("TWELVE_DATA_KEY");

  return (
    <div className="stile">
      <div className="stile__top">
        <span className="stile__name">{name}</span>
        <span className="stile__symbol">{symbol.replace(".NS", "")}</span>
      </div>
      <p className="stile__note">{note}</p>

      {!configured ? (
        <span className="stile__hint">Needs TWELVE_DATA_KEY</span>
      ) : error || data?.error ? (
        <span className="stile__hint stile__hint--error">No data</span>
      ) : loading && !data ? (
        <span className="stile__hint">Loading…</span>
      ) : (
        <div className="stile__quote">
          <span className="num stile__price">₹{data.price?.toFixed(2)}</span>
          <span className={`num stile__change ${data.changePercent >= 0 ? "gain" : "loss"}`}>
            {data.changePercent >= 0 ? "+" : ""}
            {data.changePercent?.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
