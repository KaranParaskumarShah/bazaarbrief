import { fetchGoldUsd, fetchSilverUsd, fetchBrentUsd, fetchWtiUsd } from "../services/api.js";

// kind: 'converter' | 'commodity' | 'commodity-dual' | 'unavailable'
export const MARKET_TOOLS = [
  {
    slug: "usd-inr-converter",
    category: "Market Tools",
    title: "USD to INR Converter",
    description: "Convert between US dollars and Indian rupees at the live mid-market rate.",
    kind: "converter",
  },
  {
    slug: "gold-price",
    category: "Market Tools",
    title: "Live Gold Price",
    description: "Live gold spot price in USD and INR.",
    kind: "commodity",
    unit: "per troy ounce",
    fetcher: fetchGoldUsd,
  },
  {
    slug: "silver-price",
    category: "Market Tools",
    title: "Live Silver Price",
    description: "Live silver spot price in USD and INR.",
    kind: "commodity",
    unit: "per troy ounce",
    fetcher: fetchSilverUsd,
  },
  {
    slug: "crude-oil-price",
    category: "Market Tools",
    title: "Live Crude Oil Price",
    description: "Brent and WTI crude, the two global benchmarks, side by side.",
    kind: "commodity-dual",
    unit: "per barrel",
    fetcherA: { label: "Brent Crude", fn: fetchBrentUsd },
    fetcherB: { label: "WTI Crude", fn: fetchWtiUsd },
  },
  {
    slug: "natural-gas-price",
    category: "Market Tools",
    title: "Natural Gas Price",
    description: "Henry Hub natural gas price.",
    kind: "unavailable",
    note: "No genuinely free, no-key API for natural gas was found. Add a key-based source (e.g. EIA API, free with registration) in src/services/api.js to wire this up.",
  },
];

export const getMarketToolBySlug = (slug) => MARKET_TOOLS.find((t) => t.slug === slug);
