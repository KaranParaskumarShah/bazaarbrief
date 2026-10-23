# BazaarBrief IPO audit and verification

Audit date: 2026-10-22

## Fixes made in this audit

- Fixed IPO detail enrichment to request provider detail records by the provider's `slug` when supplied, rather than assuming an exchange ticker is the provider's detail identifier.
- Made optional IPO detail enrichment failure-isolated so KV read/write failures or detail-feed errors cannot discard a valid primary IPO list snapshot.
- Sorted GMP history chronologically before selecting the latest observation and rejected blank/non-numeric GMP history values instead of interpreting blanks as zero.
- Fixed issue-size normalization when both `issueSize` and `issueSizeCr` are present; monetary issue size now uses Indian grouping (for example, `₹1,450 Cr`) rather than double-formatting or dropping grouping.
- Fixed the `/ipo/gmp` route so it actually filters to IPOs with a reported GMP and defaults to GMP-percent sorting.
- Fixed the frontend fallback chain so a successful live response is still returned when IndexedDB cache persistence fails.
- Added the optional provider detail slug to the canonical type and API schema.
- Added normalizer regression tests for issue-size formatting and provider detail slugs.
- Fixed stale IPO lifecycle labels: dates in Asia/Kolkata now override stale `UPCOMING` labels, and cached IPO responses are reclassified on read. Listing dates in the past are `Listed`; expired issue windows without a passed listing date are `Closed`; cancelled/withdrawn remains authoritative.
- Added the no-key `ipos.markets` public subscription manifest/detail adapter as a secondary enrichment feed. It captures category-wise QIB/NII/RII/employee/shareholder/total data, bid/offered shares, applications and exact-versus-lower-bound basis when supplied.
- Added KV-backed per-IPO subscription history with one row per IST calendar day (up to 30 days); each day's row is updated in place on subsequent refreshes.
- Added a detailed category subscription grid and a lot-wise retail application planner (1/2/3/5/10 lots) calculated only when lot size and upper price cap are available.
- Added tests for stale lifecycle reconciliation, subscription category parsing, share/bid/application counts, and lower-bound semantics.

## Checks completed

- TypeScript/TSX syntax transpilation: passed for 28 TypeScript/TSX source, config and test files.
- Worker strict type-check: passed against local Cloudflare API-compatible type stubs. This checks Worker/normalizer semantics but is not a substitute for `wrangler types` or the installed `@cloudflare/workers-types` package.
- IPO lifecycle/subscription runtime smoke checks: 8 passed (stale UPCOMING → OPEN, expired issue → CLOSED, past listing → LISTED, cancellation retained, category normalization, share/bid/application fields, lower-bound semantics, missing values not coerced to zero).
- CSS parsing: passed.
- Relative local import resolution: passed.
- JSON configuration parsing: passed for JSON files; `wrangler.jsonc` was inspected and is valid JSONC without comments.
- ZIP integrity: to be checked after packaging.

## Checks not completed

- Full `npm run build` / app `tsc -b`: **not verified**. Dependency installation timed out; an offline install confirmed that required packages are not present in the local npm cache.
- Vitest suite: **not run** because Vitest and app dependencies could not be installed.
- Live Cloudflare integration / upstream feed behavior: **not verified** from this environment.

## Deployment prerequisites and limitations

- A real `MARKET_CACHE` namespace is recommended for a durable shared IPO snapshot but is no longer required for basic IPO endpoint availability. Without KV, the Worker uses regional edge cache, fetches the configured delayed feed on cache miss, and serves a bounded stale IPO snapshot if the feed later fails. A 503 is returned only when all upstreams fail and no cached IPO snapshot exists.
- Preserve the existing `package-lock.json` from the repository when applying these files. This archive does not include one, so dependency resolution must not be assumed reproducible from this ZIP alone.
- The current root deployment config enables NSE's undocumented public IPO website endpoints for list/detail/category enrichment. They are not a documented or guaranteed free API; review current terms and redistribution permissions. Set `NSE_IPO_ENABLED=false` to disable them.
- Data fields that the provider does not supply remain undisclosed. GMP is unofficial and should not be treated as an exchange quote.

A completely bug-free build cannot be certified without the full dependency-backed build, Vitest suite, and live provider/deployment checks succeeding in the project's real environment.
