import { useParams } from "react-router-dom";
import { getCalculatorBySlug } from "../../data/calculators";
import { getMarketToolBySlug } from "../../data/marketTools";
import CalculatorPage from "./CalculatorPage";
import MarketToolPage from "./MarketToolPage";
import NotFound from "../NotFound";

export default function ToolRouter() {
  const { slug } = useParams();
  if (getCalculatorBySlug(slug)) return <CalculatorPage slug={slug} />;
  if (getMarketToolBySlug(slug)) return <MarketToolPage slug={slug} />;
  return <NotFound />;
}
