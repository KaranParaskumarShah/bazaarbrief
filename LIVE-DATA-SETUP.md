# Live data and API routing

The **root `wrangler.jsonc` is authoritative** for production: it deploys `worker/src/index.ts` and the built `dist/` site together. `worker/wrangler.toml` is legacy standalone configuration and is not used by the root deployment command.

## IPO request architecture

- Cloudflare Cron Trigger runs `*/15 * * * *` in UTC (96 scheduled runs/day).
- The scheduled Worker fetches IPO data, validates/normalizes it and stores one shared snapshot in `MARKET_CACHE` KV.
- `GET /api/ipos` only reads the shared snapshot. It **never calls an upstream IPO provider per visitor**. Before the first successful scheduled/admin refresh it returns a JSON `503` rather than pretending the data is empty.
- Failed refreshes leave the previous KV snapshot untouched. Successful refreshes merge by stable IPO ID so historical records are not removed just because they disappear from the current-issues feed.
- `GET /api/ipos/refresh-status` reports cache binding availability, last successful refresh, and the most recent refresh attempt/result. The IPO UI displays this freshness metadata.
- `POST /admin/refresh` requires `Authorization: Bearer <REFRESH_SECRET>`; set the secret with `npx wrangler secret put REFRESH_SECRET`.

## Required one-time KV setup

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

The string above is an instruction example, **not a deployable ID**. Replace it with the real ID before deployment. For preview/local testing, create a second namespace with `npx wrangler kv namespace create MARKET_CACHE --preview` and add its real `preview_id` to the same binding. Do not deploy a placeholder namespace ID.

## IPO data source configuration

The default provider is Xflot's documented free/no-key public endpoint: `https://www.xflot.com/api/public/market/ipos?limit=200`. Its API docs request attribution, carrying the response disclaimer and polling no more than once per minute; this Worker polls every 15 minutes and attributes Xflot in the UI. You may override `IPO_DATA_URL` with another feed only if its terms permit automated retrieval, caching and public display. Expected payload is an array, `{ "data": [...] }`, or Xflot's `{ "ipos": [...] }` response. Configure with `npx wrangler secret put IPO_DATA_URL` if the URL itself is sensitive; use a normal Worker variable for a public URL. Do not point this at a provider unless its terms allow this use.

If the KV binding is missing, IPO refresh is reported as unavailable and `GET /api/ipos` returns a structured `503`; it will not pretend an edge-local Cache API entry is a globally shared snapshot. If the configured feed fails after KV is configured, IPO refresh fails clearly and the last valid snapshot is retained. The IPO adapter intentionally does not scrape NSE/BSE pages because publicly reachable endpoints are not proof of permission for automated collection or redistribution. The app does not assume a free, redistributable GMP API exists. GMP appears only when the configured source supplies it, and is labelled unofficial with source/time when available. No GMP is fabricated.

## Deploy and verify

```bash
npm ci
npm run typecheck
npm test
npm run build
npx wrangler deploy
```

Then check:

- `GET https://bazaarbrief.in/health`
- `GET https://bazaarbrief.in/api/ipos`
- `GET https://bazaarbrief.in/api/ipos/refresh-status`
- `POST https://bazaarbrief.in/admin/refresh` with a bearer token (admin only)

The `/api/ipos` response remains a JSON array for frontend compatibility. `x-data-status` indicates a cached read; the refresh-status endpoint carries metadata. Confirm that KV is enabled and that `lastSuccessfulRefreshAt` advances after a successful refresh.

## Request and quota estimates

- 4 scheduled refreshes/hour × 24 = 96 refreshes/day.
- With the default Xflot feed or a configured `IPO_DATA_URL`: normally 1 upstream request per run (up to ~96/day); if the feed itself fans out, its internal usage is separate.
- Visitor reads do not add IPO upstream calls. They add Worker requests and KV reads; KV free-tier quotas are account/plan-specific and should be checked in Cloudflare's current limits before launch.
- KV stores one latest snapshot plus one metadata key; snapshot expiry is one year and refreshed values overwrite the same keys. Historical GMP points are not fabricated or stored unless the source actually provides them.

Free tier and redistribution limits can change. Verify current Cloudflare and provider terms before relying on these estimates.
