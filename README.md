# BazaarBrief — live-data website

**Domain:** https://bazaarbrief.in  
**Tagline:** India's Market, Simplified.

## Cloudflare dashboard deployment

This repository deploys the React frontend and API Worker together. Keep these dashboard settings:
- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

The root `wrangler.jsonc` points Wrangler to `worker/src/index.ts`, uploads `dist/`, routes `/api/*` through the Worker, enables React SPA fallback, and configures a 15-minute Cron Trigger. The IPO list can degrade to edge caching without KV, but the shared IPO snapshot, subscription enrichment throttle, and daily subscription history require the existing `MARKET_CACHE` binding. Keep that binding in both the production Worker settings and the root `wrangler.jsonc` using the actual namespace ID; a config-driven deployment can remove a dashboard-only binding.

For a one-command Windows deployment, double-click `START-HERE-WINDOWS.bat`; approve Cloudflare login if prompted. The script builds and deploys this same combined Worker (it does not create a separate Pages project).

## Deploy

1. Extract the ZIP and push all changed files to the connected GitHub repository's `main` branch.
2. Do not leave the old `public/_redirects` file in GitHub. The SPA fallback is configured in `wrangler.jsonc`; the old catch-all redirect conflicts with Cloudflare's asset router.
3. Cloudflare should run `npm run build` followed by `npx wrangler deploy`.
4. Verify `https://bazaarbrief.in/health`, then `https://bazaarbrief.in/api/indices` and `https://bazaarbrief.in/api/news`. `/health` should return JSON with `service: bazaarbrief-data`. A data endpoint returns a JSON array on success or HTTP 503 JSON explaining why the upstream is unavailable.

## Data refresh and limits

- Browser queries refresh regularly; edge cache TTL varies by dataset. Cron runs every 15 minutes UTC and attempts to warm the edge cache.
- Indices/history use the Yahoo Finance chart endpoint, which is unofficial and may be blocked or unsuitable for commercial redistribution.
- IPO and FII/DII use undocumented NSE website endpoints unless a permitted normalized feed URL is configured. These may fail or change.
- News uses public RSS feeds. A provider failure remains an explicit unavailable state. No fabricated market prices, IPO records, GMP, or institutional flow values are created.
- Upstream data is not guaranteed to be real-time. Review exchange/provider terms before public or commercial redistribution.

## Local development

Install Node.js 20+ and run `npm install`, then `npm run dev`. API requests need a running Cloudflare Worker (or deployed API). `VITE_DATA_BASE_URL` can point to a separate API for local development; leave it empty for same-origin production requests.

## Checks

```bash
npm install
npm run typecheck
npm test
npm run build
```

The Worker is bundled by `wrangler deploy`; the dashboard's deploy step reports Worker bundling/configuration errors.


## IPO intelligence UI and data pipeline

The IPO dashboard uses a compact market-monitor table, status/board/GMP filters, tabular financial numerals, and a detail view for timeline, issue breakup, subscription, GMP history and registrar links. Fields are only rendered as reported by configured providers; missing financial statements, subscription snapshots, quota splits and registrar links are not fabricated.

The Worker reads from a primary configured IPO list, can optionally merge a separately configured secondary JSON feed, and can opt into the undocumented NSE public IPO endpoint after terms review. Xflot per-IPO detail enrichment is throttled to a small batch every 10 minutes, and category subscription enrichment only requests current/recent issues. The 15-minute cron refreshes the shared snapshot; KV retention keeps the last successful snapshot available through temporary provider failures. See `docs/API-sources.md` and `LIVE-DATA-SETUP.md` before enabling additional feeds.

### Build and test

Run `npm install`, then `npm run build` and `npm test`. Cloudflare production builds use `npm run build`. This source package does not include a generated dependency lockfile; preserve the repository's existing `package-lock.json` when applying these changes so Cloudflare's `npm clean-install` continues to work.
