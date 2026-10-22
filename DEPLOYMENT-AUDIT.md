# BazaarBrief IPO deployment audit

## Current production behavior

- `GET /api/ipos` prefers the shared `MARKET_CACHE` KV snapshot when configured. Without KV, it uses the regional Cloudflare Cache API and fetches the configured public IPO feed on cache miss.
- Successful data is cached for 10 minutes in the regional cache. A separate 24-hour IPO snapshot is retained as a fallback. If the upstream fails, the Worker can return the snapshot with `x-data-status: stale-cache` rather than making the dashboard look empty.
- KV remains recommended because it provides a durable shared snapshot across regions and lets the scheduled Worker preserve metadata and prior issue fields. No account-specific KV namespace ID is guessed or committed.
- The scheduled refresh runs every 15 minutes. The default IPO source is the configured public Xflot endpoint; a secondary JSON feed can be configured only when its terms permit automated retrieval and public display.
- The frontend's `/api/ipos` response remains a JSON array for backward compatibility. The refresh-status endpoint includes `persistentCacheEnabled` and `cacheMode`.
- Cloudflare Insights CSP warning was separate from the API failure. The `script-src` policy now explicitly permits `https://static.cloudflareinsights.com`.

## Checks performed for the 22 October 2026 API 503 fix

- Worker and shared normalizer strict TypeScript check: passed using local Cloudflare API-compatible declarations.
- Simulated `/api/ipos` request with no KV binding and a valid delayed provider response: HTTP 200, one normalized record.
- Simulated upstream HTTP 503 after a successful fetch with a stale snapshot present: HTTP 200 and `x-data-status: stale-cache`.
- `wrangler.jsonc` parse check: passed.
- Full `npm run build` / Vitest suite: not run because dependencies are not available in the environment and registry DNS could not resolve.
- Live Xflot/Cloudflare integration: not verified from this environment; verify after deployment.

## Deploy and verify

1. Push the updated `worker/src/index.ts`, `public/_headers`, `LIVE-DATA-SETUP.md`, and audit docs to the production repository.
2. Deploy the combined Worker + static assets using the repository's root `wrangler.jsonc`.
3. Open `https://bazaarbrief.in/health` and confirm `ipoReady: true`.
4. Open `https://bazaarbrief.in/api/ipos`. On success it should return a JSON array and an `x-data-status` header of `live`, `cached`, or `stale-cache`.
5. Open `https://bazaarbrief.in/api/ipos/refresh-status` to confirm cache mode and refresh metadata.

A 503 can still occur if the provider is unreachable on a cold cache and no stale snapshot exists. That is an upstream availability condition, not an empty IPO list; inspect the JSON `detail` field and Worker logs.

## Additional 22 October 2026 provider resilience fix

- Switched the default Xflot endpoint to the apex host used in its published API examples and added the `www` host as a fallback for host-specific routing incidents.
- IPO feed parser now accepts nested envelopes such as `{ data: { ipos: [...] } }` and rejects unknown/empty response shapes so a provider schema change is reported clearly instead of being mistaken for a valid list.
- Added regression tests for the documented Xflot envelope, nested gateway envelopes, and unknown payloads.
- **Required production setup:** the root `wrangler.jsonc` still has no `MARKET_CACHE` namespace because a real account-specific namespace ID cannot be guessed. Create a KV namespace and bind it as `MARKET_CACHE` in Cloudflare Workers & Pages settings (or add the real ID to root `wrangler.jsonc`), then deploy and invoke `/admin/refresh` using the configured `REFRESH_SECRET`. Without KV, the cache is regional and a cold region can still return 503 if both provider hosts and other configured sources are unavailable.
