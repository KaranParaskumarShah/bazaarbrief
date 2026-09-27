# Bazaar Brief
Frontend-only React/Vite market + IPO dashboard.

## Run
npm install
npm run dev

## Production
npm run build

## Live market API (optional)
Copy `.env.example` to `.env` and add `VITE_TWELVE_DATA_KEY`.
Without a key, the site intentionally renders the dated 25 Sep 2026 snapshot immediately. When a browser API succeeds, the latest quote replaces the snapshot. The browser retries every 2 hours while the site is open and when the tab becomes active after the cache is older than 2 hours.

## Important
VITE_ variables are exposed to the browser. Use only an API plan that permits browser/client-side use and commercial display. Never put a secret server token in this frontend.
