# Live data and API routing

This build uses one Cloudflare Worker deployment for the website and API. The root `wrangler.jsonc` has `main: ./worker/src/index.ts`, serves the `dist` directory, and sets `assets.run_worker_first` for `/api/*`, `/health`, and `/admin/*`. This is required: without Worker-first routing, `/api/indices` can fall back to the React `index.html` and the frontend will not receive JSON. See Cloudflare's official routing documentation: https://developers.cloudflare.com/workers/static-assets/ and https://developers.cloudflare.com/workers/static-assets/binding/.

No KV ID is required for first deployment. API endpoints fetch real upstream data on a cache miss and return explicit HTTP 503 JSON if a source is blocked or returns invalid data. The optional `MARKET_CACHE` binding enables durable KV storage; if not configured, the Worker uses short-lived edge cache and on-demand fetches. Cron attempts refreshes every 15 minutes UTC.

Check after deploy:
- `GET /health` → service JSON
- `GET /api/indices` → real quote array or 503 JSON with detail
- `GET /api/news` → real headlines or 503 JSON with detail
- `GET /api/ipos` and `GET /api/fii-dii` → normalized records or 503 JSON with detail

Do not add sample/fake data to hide provider errors.
