import StockTile from "./StockTile";
import "./StockCategorySection.css";

export default function StockCategorySection({ category }) {
  return (
    <div className="scat">
      <div className="scat__head">
        <h3>{category.label}</h3>
        <p>{category.blurb}</p>
      </div>
      <div className="scat__grid">
        {category.stocks.map((s) => (
          <StockTile key={s.symbol} {...s} />
        ))}
      </div>
    </div>
  );
}
