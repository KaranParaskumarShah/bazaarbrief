export const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;
export const CACHE_KEY = 'bazaarbrief:latest-data:v3';
export const CACHE_TTL_MS = REFRESH_INTERVAL_MS;

// Frontend-only configuration. Values are exposed to the browser by design.
// For a production app with private API keys, a server-side proxy is required.
export const API_KEYS = {
  TWELVE_DATA: import.meta.env.VITE_TWELVE_DATA_KEY || '',
  NEWS: import.meta.env.VITE_GNEWS_KEY || '',
};

export const DATA_CONFIG = {
  refreshIntervalMs: REFRESH_INTERVAL_MS,
  provider: 'Twelve Data + public IPO/news feeds',
};
