# BazaarBrief IPO implementation audit — 17 October 2026

## Fixes implemented in this revision

- IPO endpoint no longer fetches external providers on visitor cache misses; it returns an explicit JSON 503 until a scheduled/admin refresh populates the shared snapshot.
- Added a refresh-status endpoint and KV metadata (`lastSuccessfulRefreshAt`, record count and source label).
- IPO normalization is shared in a dependency-free module used by the Worker and tests. It accepts legitimate partial/historical rows, maps Xflot's documented `slug`, `board`, `priceMin`, `priceMax`, `issueSizeCr`, `lastGmp`, `lastGmpPct` and `lastSubX` fields, and does not infer Listed solely because the closing date passed.
- Provider endpoint errors are logged and included in the refresh report. Configured JSON feeds retry HTTP 429 and transient 5xx responses up to two times with bounded backoff.
- Successful IPO refreshes merge with the previous KV snapshot and preserve existing non-empty fields when a new feed omits them. A failed refresh never writes an empty replacement snapshot.
- Frontend schema and rendering support cancelled/withdrawn statuses and missing fields, and show GMP as unavailable rather than zero when not supplied.
- Root `wrangler.jsonc` remains the production configuration. Removed the invalid placeholder KV IDs from the legacy worker config. A real namespace ID must be added to the root config after the owner creates a namespace in their Cloudflare account.

## Provider / compliance boundary

The default provider is Xflot's documented free/no-key public IPO JSON API. Its docs request attribution, carrying its disclaimer and polling no more than once per minute; this Worker polls every 15 minutes. `IPO_DATA_URL` can override it with a provider/feed whose terms explicitly permit automated collection, caching and public display. Without it, the IPO refresh fails clearly and preserves the previous snapshot; the IPO adapter does not scrape exchange pages without permission. GMP remains optional and is not invented. NSE/BSE terms and any vendor license must be reviewed before commercial public display.

## Deployment requirements

Create a KV namespace and add its real ID to root `wrangler.jsonc` before deploying. IPO refresh is deliberately marked unavailable without KV; the regional Cache API is not treated as a shared persistent source of truth. Instructions and request estimates are in `LIVE-DATA-SETUP.md`. The Cron Trigger is `*/15 * * * *` UTC.

## Validation status

The shared normalizer passes standalone TypeScript typechecking and runtime checks against the documented Xflot payload shape. Modified TypeScript/TSX files pass syntax transpilation. Full `npm run typecheck`, `npm test` and `npm run build` could not be completed because dependency installation timed out in this environment; do not treat source edits as proof of a successful Cloudflare deployment or live provider access. The current data source may return no usable records if upstream endpoints block access or require authorization.
