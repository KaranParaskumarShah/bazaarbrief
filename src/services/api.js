import { API_KEYS, ENDPOINTS } from "../config";

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

// Gold spot, USD per troy ounce. Free, no key.
export async function fetchGoldUsd() {
  const data = await getJSON(ENDPOINTS.GOLD_USD);
  const entry = data?.symbols?.[0];
  if (!entry) throw new Error("Gold price missing from response");
  return { price: parseFloat(entry.price), asOf: entry.computed_at, stale: entry.is_stale };
}

// Brent crude, USD per barrel. Free, no key.
export async function fetchBrentUsd() {
  const data = await getJSON(ENDPOINTS.BRENT_USD);
  // UKOilWatch returns a small object with the latest price; be defensive
  // about the exact field name since it's a third-party free service.
  const price = data?.price ?? data?.brent ?? data?.value;
  if (price == null) throw new Error("Brent price missing from response");
  return { price: parseFloat(price), asOf: data?.date ?? data?.updated ?? null };
}

// WTI crude, USD per barrel. Needs a free OilPriceAPI key.
export async function fetchWtiUsd() {
  if (!API_KEYS.OILPRICE_KEY) return null;
  const res = await fetch(ENDPOINTS.WTI_USD(API_KEYS.OILPRICE_KEY), {
    headers: { Authorization: `Token ${API_KEYS.OILPRICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json();
  return { price: parseFloat(data?.data?.price), asOf: data?.data?.created_at };
}

// Silver / Copper spot, USD. Needs a free MetalpriceAPI key.
export async function fetchMetalUsd(symbol) {
  if (!API_KEYS.METALPRICE_KEY) return null;
  const data = await getJSON(ENDPOINTS.METAL(symbol, API_KEYS.METALPRICE_KEY));
  const rate = data?.rates?.[symbol];
  if (!rate) throw new Error(`${symbol} price missing from response`);
  // metalpriceapi returns currency-per-metal-unit as a ratio; invert to get USD price
  return { price: 1 / rate, asOf: data?.timestamp ? new Date(data.timestamp * 1000).toISOString() : null };
}

// Single India equity quote. Needs a free Twelve Data key.
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

export function hasKey(name) {
  return Boolean(API_KEYS[name]);
}
