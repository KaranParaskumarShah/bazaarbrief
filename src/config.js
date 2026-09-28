// ─────────────────────────────────────────────────────────────────────────
// API CONFIG
// ─────────────────────────────────────────────────────────────────────────
// Genuinely free, no-key, CORS-enabled sources (verified working):
//   - Gold & silver spot   -> goldprice.dev
//   - Brent & WTI crude    -> ukoilwatch.com / americasoilwatch.com
//   - USD -> INR rate      -> open.er-api.com
//
// Still need a free-tier key because no honest no-key source exists:
//   TWELVE_DATA_KEY   -> https://twelvedata.com/   (all stocks + indices)
//   METALPRICE_KEY    -> https://metalpriceapi.com/ (copper only)
//
// Until a key is added, that widget shows "needs a free API key" instead
// of a fake number.
// ─────────────────────────────────────────────────────────────────────────

export const API_KEYS = {
  TWELVE_DATA_KEY: "",
  METALPRICE_KEY: "",
};

export const ENDPOINTS = {
  GOLD_USD: "https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT",
  SILVER_USD: "https://api.goldprice.dev/v1/prices?symbol=XAG-USD-SPOT",
  FOREX_USD_BASE: "https://open.er-api.com/v6/latest/USD",
  BRENT_USD: "https://ukoilwatch.com/api/v1/brent",
  WTI_USD: "https://americasoilwatch.com/api/v1/wti",
  METAL: (symbol, key) =>
    `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=${symbol}`,
  STOCK_QUOTE: (symbol, key) =>
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${key}`,
};

// Every widget refetches on this interval. Set to 2 hours per product
// decision: this data doesn't need second-by-second polling, and staying
// well under every provider's free-tier rate limit matters more.
export const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function hasKey(name) {
  return Boolean(API_KEYS[name]);
}
