# BazaarBrief deployment/API audit — 13 October 2026

## Root cause found

The prior frontend could load while its `/api/*` requests did not reach the data Worker. The prior API handler only read from KV; when the KV cache was empty, it returned HTTP 503 and never tried fetching a dataset on the first API request. Also, a static-only deployment can return the SPA shell for unknown `/api/*` paths unless Worker-first routing is configured.

## Changes in this ZIP

1. The root `wrangler.jsonc` deploys `worker/src/index.ts` and `dist/` together.
2. `assets.run_worker_first` routes `/api/*`, `/health`, and `/admin/*` to the Worker before SPA fallback.
3. API handlers fetch upstream data on a cache miss, so first-use does not require waiting for the next 15-minute cron.
4. KV is optional for first deployment; edge cache is used as a best-effort cache. If KV is later configured, datasets are also written to KV.
5. API errors return a 503 JSON body with a dataset and failure detail rather than silently returning HTML or fabricated records.
6. Cron runs every 15 minutes and tries to warm cached datasets.
7. The old catch-all `public/_redirects` file is absent; SPA fallback is handled by Wrangler asset configuration.

## Still dependent on external sources

Yahoo Finance and NSE endpoints are unofficial/undocumented and can block requests, change schema, or have terms limiting redistribution. IPO/FII/DII data cannot be guaranteed until a permitted feed succeeds. News feeds can also be unavailable. The implementation intentionally does not generate mock financial values.

## Cloudflare settings

- Root directory `/`
- Build command `npm run build`
- Deploy command `npx wrangler deploy`

No KV placeholder or `VITE_DATA_BASE_URL` build variable is required for same-origin production.
