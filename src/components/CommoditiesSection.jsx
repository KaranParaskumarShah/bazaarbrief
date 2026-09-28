import { usePolling } from "../hooks/usePolling";
import {
  fetchUsdInrRate,
  fetchGoldUsd,
  fetchSilverUsd,
  fetchBrentUsd,
  fetchWtiUsd,
  fetchCopperUsd,
} from "../services/api";
import CommodityCard from "./CommodityCard";
import "./CommoditiesSection.css";

export default function CommoditiesSection() {
  const fx = usePolling(fetchUsdInrRate, []);
  const gold = usePolling(fetchGoldUsd, []);
  const brent = usePolling(fetchBrentUsd, []);
  const wti = usePolling(fetchWtiUsd, []);
  const silver = usePolling(fetchSilverUsd, []);
  const copper = usePolling(fetchCopperUsd, []);

  const rate = fx.data;
  const toInr = (usd) => (usd != null && rate ? usd * rate : null);

  return (
    <section className="section">
      <div className="section__head">
        <h2>Commodities</h2>
        <p>
          Spot / front-month prices in US dollars, converted to rupees at the live USD–INR rate
          {rate ? <span className="num"> (₹{rate.toFixed(2)}/$)</span> : null}.
        </p>
      </div>

      <div className="ccard-grid">
        <CommodityCard
          name="Brent Crude"
          unit="per barrel"
          state={brent}
          priceUsd={brent.data?.price}
          priceInr={toInr(brent.data?.price)}
        />
        <CommodityCard
          name="Crude Oil (WTI)"
          unit="per barrel"
          state={wti}
          priceUsd={wti.data?.price}
          priceInr={toInr(wti.data?.price)}
        />
        <CommodityCard
          name="Gold"
          unit="per troy oz"
          state={gold}
          priceUsd={gold.data?.price}
          priceInr={toInr(gold.data?.price)}
        />
        <CommodityCard
          name="Silver"
          unit="per troy oz"
          state={silver}
          priceUsd={silver.data?.price}
          priceInr={toInr(silver.data?.price)}
        />
        <CommodityCard
          name="Copper"
          unit="per lb"
          state={copper}
          priceUsd={copper.data?.price}
          priceInr={toInr(copper.data?.price)}
          keyName="METALPRICE_KEY"
        />
      </div>
    </section>
  );
}
