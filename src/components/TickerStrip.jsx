import "./TickerStrip.css";

// items: [{ label, value, changeDir: 'up' | 'down' | null }]
export default function TickerStrip({ items }) {
  if (!items?.length) return null;
  // duplicate the list so the CSS marquee can loop seamlessly
  const loop = [...items, ...items];

  return (
    <div className="ticker" role="status" aria-label="Live market snapshot">
      <div className="ticker__track">
        {loop.map((item, i) => (
          <span className="ticker__item" key={i}>
            <span className="ticker__label">{item.label}</span>
            <span className={`ticker__value num ${item.changeDir === "down" ? "loss" : item.changeDir === "up" ? "gain" : ""}`}>
              {item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
