import { API_KEYS, ENDPOINTS } from "../config.js";
import { resilientFetchJSON } from "./cache.js";

// USD -> INR rate. Free, no key.
export async function fetchUsdInrRate() {
  const data = await resilientFetchJSON(ENDPOINTS.FOREX_USD_BASE);
  const rate = data?.rates?.INR;
  if (!rate) throw new Error("INR rate missing from response");
  return rate;
}

// Gold spot, USD per troy ounce. Free, no key. (goldprice.dev)
export async function fetchGoldUsd() {
  const data = await resilientFetchJSON(ENDPOINTS.GOLD_USD);
  if (data?.price == null) throw new Error("Gold price missing from response");
  return { price: parseFloat(data.price), asOf: data.computed_at };
}

// Silver spot, USD per troy ounce. Free, no key. (goldprice.dev)
export async function fetchSilverUsd() {
  const data = await resilientFetchJSON(ENDPOINTS.SILVER_USD);
  if (data?.price == null) throw new Error("Silver price missing from response");
  return { price: parseFloat(data.price), asOf: data.computed_at };
}

// Brent crude, USD per barrel. Free, no key. (ukoilwatch.com)
export async function fetchBrentUsd() {
  const data = await resilientFetchJSON(ENDPOINTS.BRENT_USD);
  if (data?.priceUsd == null) throw new Error("Brent price missing from response");
  return { price: data.priceUsd, asOf: data.observedAt, changePct: data.changePct };
}

// WTI crude, USD per barrel. Free, no key. (americasoilwatch.com)
export async function fetchWtiUsd() {
  const data = await resilientFetchJSON(ENDPOINTS.WTI_USD);
  if (data?.priceUsd == null) throw new Error("WTI price missing from response");
  return { price: data.priceUsd, asOf: data.observedAt, changePct: data.changePct };
}

// Copper spot, USD per lb. Needs a free MetalpriceAPI key.
export async function fetchCopperUsd() {
  if (!API_KEYS.METALPRICE_KEY) return null;
  const data = await resilientFetchJSON(ENDPOINTS.METAL("XCU", API_KEYS.METALPRICE_KEY));
  const rate = data?.rates?.XCU;
  if (!rate) throw new Error("Copper price missing from response");
  return { price: 1 / rate, asOf: data?.timestamp ? new Date(data.timestamp * 1000).toISOString() : null };
}

export { hasKey } from "../config.js";
