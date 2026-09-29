// ─────────────────────────────────────────────────────────────────────────
// API CONFIG
// ─────────────────────────────────────────────────────────────────────────
// Genuinely free, no-key, CORS-safe (via relay fallback, see services/cache.js):
//   - Gold & silver spot   -> goldprice.dev
//   - Brent & WTI crude    -> ukoilwatch.com / americasoilwatch.com
//   - USD -> INR rate      -> open.er-api.com
//   - Markets news         -> Economic Times RSS (see services/news.js)
//
// Still needs a free-tier key because no honest no-key source exists:
//   METALPRICE_KEY    -> https://metalpriceapi.com/ (copper only)
//
// Until a key is added, that widget shows "needs a free API key" instead
// of a fake number. (Stock/index quotes were removed on purpose — see README.)
// ─────────────────────────────────────────────────────────────────────────

export const API_KEYS = {
  METALPRICE_KEY: "",
};

export const ENDPOINTS = {
  GOLD_USD: "https://api.goldprice.dev/v1/spot/XAU-USD-SPOT",
  SILVER_USD: "https://api.goldprice.dev/v1/spot/XAG-USD-SPOT",
  FOREX_USD_BASE: "https://open.er-api.com/v6/latest/USD",
  BRENT_USD: "https://ukoilwatch.com/api/v1/brent",
  WTI_USD: "https://americasoilwatch.com/api/v1/wti",
  METAL: (symbol, key) =>
    `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=${symbol}`,
};

// Every widget refetches on this interval. Set to 2 hours per product
// decision: this data doesn't need second-by-second polling, and staying
// well under every provider's free-tier rate limit matters more.
export const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function hasKey(name) {
  return Boolean(API_KEYS[name]);
}
