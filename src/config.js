// ─────────────────────────────────────────────────────────────────────────
// API CONFIG
// ─────────────────────────────────────────────────────────────────────────
// This app talks directly to public APIs from the browser (no backend yet).
// A few data points are genuinely free with no signup. The rest need a
// free-tier API key because no honest no-key source exists for them —
// paste your own free keys below and that section will switch itself on.
//
// Where to get free keys (all have a free tier, no credit card):
//   TWELVE_DATA_KEY   -> https://twelvedata.com/          (stocks: India NSE symbols)
//   METALPRICE_KEY    -> https://metalpriceapi.com/       (silver, copper spot)
//   OILPRICE_KEY      -> https://www.oilpriceapi.com/     (WTI crude oil)
//
// Until a key is added, that widget shows a clear "connect a free API key"
// state instead of fake numbers.
// ─────────────────────────────────────────────────────────────────────────

export const API_KEYS = {
  TWELVE_DATA_KEY: "",
  METALPRICE_KEY: "",
  OILPRICE_KEY: "",
};

export const ENDPOINTS = {
  // Free, no key, CORS-enabled. Gold spot price in USD.
  GOLD_USD: "https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT",
  // Free, no key, CORS-enabled. USD -> all currencies (we read INR).
  FOREX_USD_BASE: "https://open.er-api.com/v6/latest/USD",
  // Free, no key, CORS-enabled. Brent crude, front-month futures.
  BRENT_USD: "https://ukoilwatch.com/api/v1/brent",
  // Needs free key. WTI crude oil.
  WTI_USD: (key) => `https://api.oilpriceapi.com/v1/prices/latest?by_code=WTI_USD`,
  // Needs free key. Silver / Copper spot.
  METAL: (symbol, key) =>
    `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=${symbol}`,
  // Needs free key. Indian equities via NSE symbol, e.g. RELIANCE.NS
  STOCK_QUOTE: (symbol, key) =>
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${key}`,
};

export const REFRESH_INTERVAL_MS = 60_000;
