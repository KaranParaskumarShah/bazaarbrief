import { API_KEYS, ENDPOINTS } from "../config.js";

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// USD -> INR rate. Free, no key.
export async function fetchUsdInrRate() {
  const data = await getJSON(ENDPOINTS.FOREX_USD_BASE);
  const rate = data?.rates?.INR;
  if (!rate) throw new Error("INR rate missing from response");
  return rate;
}

// Gold spot, USD per troy ounce. Free, no key. (goldprice.dev)
export async function fetchGoldUsd() {
  const data = await getJSON(ENDPOINTS.GOLD_USD);
  const entry = data?.symbols?.[0];
  if (!entry) throw new Error("Gold price missing from response");
  return { price: parseFloat(entry.price), asOf: entry.computed_at };
}

// Silver spot, USD per troy ounce. Free, no key. (goldprice.dev)
export async function fetchSilverUsd() {
  const data = await getJSON(ENDPOINTS.SILVER_USD);
  const entry = data?.symbols?.[0];
  if (!entry) throw new Error("Silver price missing from response");
  return { price: parseFloat(entry.price), asOf: entry.computed_at };
}

// Brent crude, USD per barrel. Free, no key. (ukoilwatch.com)
// Field is `priceUsd` — a wrong field name here was the earlier bug.
export async function fetchBrentUsd() {
  const data = await getJSON(ENDPOINTS.BRENT_USD);
  if (data?.priceUsd == null) throw new Error("Brent price missing from response");
  return { price: data.priceUsd, asOf: data.observedAt, changePct: data.changePct };
}

// WTI crude, USD per barrel. Free, no key. (americasoilwatch.com)
export async function fetchWtiUsd() {
  const data = await getJSON(ENDPOINTS.WTI_USD);
  if (data?.priceUsd == null) throw new Error("WTI price missing from response");
  return { price: data.priceUsd, asOf: data.observedAt, changePct: data.changePct };
}

// Copper spot, USD per lb. Needs a free MetalpriceAPI key.
export async function fetchCopperUsd() {
  if (!API_KEYS.METALPRICE_KEY) return null;
  const data = await getJSON(ENDPOINTS.METAL("XCU", API_KEYS.METALPRICE_KEY));
  const rate = data?.rates?.XCU;
  if (!rate) throw new Error("Copper price missing from response");
  return { price: 1 / rate, asOf: data?.timestamp ? new Date(data.timestamp * 1000).toISOString() : null };
}

// Single equity or index quote. Needs a free Twelve Data key.
// Used for both India stocks (RELIANCE.NS) and indices (IXIC, NSEI, ...).
export async function fetchStockQuote(symbol) {
  if (!API_KEYS.TWELVE_DATA_KEY) return null;
  const data = await getJSON(ENDPOINTS.STOCK_QUOTE(symbol, API_KEYS.TWELVE_DATA_KEY));
  if (data?.status === "error" || !data?.close) return { error: data?.message || "No data" };
  return {
    price: parseFloat(data.close),
    changePercent: parseFloat(data.percent_change),
    currency: data.currency || "INR",
  };
}

export { hasKey } from "../config.js";
