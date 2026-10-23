# Live data and API routing

The **root `wrangler.jsonc` is authoritative** for production: it deploys `worker/src/index.ts` and the built `dist/` site together. `worker/wrangler.toml` is legacy standalone configuration and is not used by the root deployment command.

## IPO request architecture

- Cloudflare Cron Trigger wakes the Worker every 15 minutes in UTC (`*/15 * * * *`, 96 trigger events/day).
- The Worker gates refresh work using `Asia/Kolkata`: every 15 minutes from 09:00 to before 17:00 IST, and once per hour outside that window. Because Cloudflare cron is UTC-based, do not change the trigger to a simple 09:00–17:00 UTC hour range.
- When a refresh is due, the scheduled Worker fetches IPO data, validates/normalizes it and stores one shared snapshot in `MARKET_CACHE` KV.
- `GET /api/ipos` prefers the shared KV snapshot. If KV is missing or has not been populated yet, it fetches the configured public IPO feed, caches the result regionally, and returns delayed data. This fallback is not a substitute for shared KV durability.
- Failed refreshes leave the previous KV snapshot untouched. Successful refreshes merge by stable IPO ID so historical records are not removed just because they disappear from the current-issues feed.
- `GET /api/ipos/refresh-status` reports cache binding availability, last successful refresh, and the most recent refresh attempt/result. The IPO UI displays this freshness metadata.
- `POST /admin/refresh` requires `Authorization: Bearer <REFRESH_SECRET>`; set the secret with `npx wrangler secret put REFRESH_SECRET`.

## Recommended one-time KV setup (regional fallback works without it)

KV namespace IDs are account-specific and cannot safely be guessed or committed. Create the namespace first:

```bash
npx wrangler kv namespace create MARKET_CACHE
```

Copy the real `id` from Wrangler's output. Add this binding to the root `wrangler.jsonc` at the top level (not under `vars`):

```json
"kv_namespaces": [
  { "binding": "MARKET_CACHE", "id": "PASTE_THE_REAL_ID_FROM_WRANGLER" }
],
```

The string above is an instruction example, **not a deployable ID**. Because you already created `MARKET_CACHE`, run `npx wrangler kv namespace list` and copy the ID for that existing namespace; do not create a second one. Replace the example with the real ID before deploying. This binding must live in the root `wrangler.jsonc` as well as the production dashboard, otherwise a config-driven deployment can remove the dashboard-only binding. For preview/local testing, use a separate namespace only if you need isolated preview data.

## IPO data source configuration

The default provider is Xflot's documented free/no-key public endpoint: `https://xflot.com/api/public/market/ipos?limit=200`. Its API docs request attribution, carrying the response disclaimer and polling no more than once per minute; this Worker polls every 15 minutes and attributes Xflot in the UI. You may override `IPO_DATA_URL` with another feed only if its terms permit automated retrieval, caching and public display. Expected payload is an array or a response containing `ipos`, `data`, `results`, `items`, or `records`; nested `data.ipos` is supported. If the default provider host fails, the Worker retries the alternate `www` host before using other configured fallbacks. Configure with `npx wrangler secret put IPO_DATA_URL` if the URL itself is sensitive; use a normal Worker variable for a public URL. Do not point this at a provider unless its terms allow this use.

If the KV binding is missing, `GET /api/ipos` uses Cloudflare's regional Cache API and fetches the configured feed on a cache miss. If the upstream is temporarily unavailable, a previously cached IPO snapshot can be returned with `x-data-status: stale-cache`. This fallback may differ by Cloudflare region and is less durable than KV. With KV configured, the shared snapshot remains the source of truth. If all upstreams fail and no stale snapshot exists, the API returns a structured `503` with the provider error. The IPO adapter intentionally does not scrape NSE/BSE pages because publicly reachable endpoints are not proof of permission for automated collection or redistribution. The app does not assume a free, redistributable GMP API exists. GMP appears only when the configured source supplies it, and is labelled unofficial with source/time when available. No GMP is fabricated.

## Deploy and verify

```bash
npm ci
npm run typecheck
npm test
npm run build
npx wrangler deploy
```

Set the manual refresh secret once (if not already configured): `npx wrangler secret put REFRESH_SECRET`. After deploying the updated Worker, trigger one refresh immediately instead of waiting for the next cron:

```bash
curl -X POST https://bazaarbrief.in/admin/refresh -H "Authorization: Bearer YOUR_REFRESH_SECRET"
```

Keep the secret private; do not put it in frontend code. Then check:

- `GET https://bazaarbrief.in/health`
- `GET https://bazaarbrief.in/api/ipos` (should return a JSON array; `x-data-status` identifies live, cached or stale-cache data)
- `GET https://bazaarbrief.in/api/ipos/refresh-status`
- `POST https://bazaarbrief.in/admin/refresh` with a bearer token (admin only)

The `/api/ipos` response remains a JSON array for frontend compatibility. `x-data-status` indicates a cached read; the refresh-status endpoint carries metadata. Confirm that KV is enabled and that `lastSuccessfulRefreshAt` advances after a successful refresh.

## Request and quota estimates

- The cron has 96 trigger events/day, but the IST gate currently runs about 48 scheduled refresh batches/day: every 15 minutes during 09:00–16:45 IST, then hourly from 17:00 onward.
- Base IPO list: up to about 48 requests/day from scheduled batches, before retries/fallbacks. The optional detail and subscription enrichers can make additional provider requests per batch; actual counts depend on issue matching, detail URLs, retries and provider coverage. Review provider terms and Worker subrequest limits before enabling all enrichers at scale.
- Visitor reads do not add IPO upstream calls. They add Worker requests and KV reads; KV free-tier quotas are account/plan-specific and should be checked in Cloudflare's current limits before launch.
- KV stores one latest snapshot plus one metadata key; snapshot expiry is one year and refreshed values overwrite the same keys. Historical GMP points are not fabricated or stored unless the source actually provides them.

Free tier and redistribution limits can change. Verify current Cloudflare and provider terms before relying on these estimates.


### Optional IPO data enrichers

The existing Xflot provider is the default list/detail source. To add a second JSON feed, configure `IPO_SECONDARY_DATA_URL` as a Worker environment variable. It must return an array or an object with `data` or `ipos` arrays and must permit automated collection and public display. To test NSE's public issue endpoint, review its current terms first, then set `NSE_IPO_ENABLED=true`; it is deliberately off by default because the endpoint is undocumented and may block automated access. Do not add API keys to frontend `VITE_` variables. Provider coverage varies; fields not present in the source remain undisclosed rather than fabricated.
