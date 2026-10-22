# BazaarBrief IPO audit and verification

Audit date: 2026-10-20

## Fixes made in this audit

- Fixed IPO detail enrichment to request provider detail records by the provider's `slug` when supplied, rather than assuming an exchange ticker is the provider's detail identifier.
- Made optional IPO detail enrichment failure-isolated so KV read/write failures or detail-feed errors cannot discard a valid primary IPO list snapshot.
- Sorted GMP history chronologically before selecting the latest observation and rejected blank/non-numeric GMP history values instead of interpreting blanks as zero.
- Fixed issue-size normalization when both `issueSize` and `issueSizeCr` are present; monetary issue size now uses Indian grouping (for example, `₹1,450 Cr`) rather than double-formatting or dropping grouping.
- Fixed the `/ipo/gmp` route so it actually filters to IPOs with a reported GMP and defaults to GMP-percent sorting.
- Fixed the frontend fallback chain so a successful live response is still returned when IndexedDB cache persistence fails.
- Added the optional provider detail slug to the canonical type and API schema.
- Added normalizer regression tests for issue-size formatting and provider detail slugs.

## Checks completed

- TypeScript/TSX syntax transpilation: passed for 26 TypeScript/TSX source, config and test files.
- Worker strict type-check: passed against local Cloudflare API-compatible type stubs. This checks Worker/normalizer semantics but is not a substitute for `wrangler types` or the installed `@cloudflare/workers-types` package.
- IPO normalizer runtime smoke checks: 6 passed (partial historical row, SME/GMP parsing, GMP percentage, minimum investment, Indian issue-size formatting, provider detail slug).
- CSS parsing: passed.
- Relative local import resolution: passed.
- JSON configuration parsing: passed for JSON files; `wrangler.jsonc` was inspected and is valid JSONC without comments.
- ZIP integrity: to be checked after packaging.

## Checks not completed

- Full `npm run build` / app `tsc -b`: **not verified**. Dependency installation timed out; an offline install confirmed that required packages are not present in the local npm cache.
- Vitest suite: **not run** because Vitest and app dependencies could not be installed.
- Live Cloudflare integration / upstream feed behavior: **not verified** from this environment.

## Deployment prerequisites and limitations

- The source archive intentionally does not invent a Cloudflare KV namespace ID. Configure the real `MARKET_CACHE` binding in the Cloudflare dashboard or `wrangler.jsonc` before deploying IPO snapshots; without it, `/api/ipos` correctly returns a clear 503 instead of pretending a shared cache exists.
- Preserve the existing `package-lock.json` from the repository when applying these files. This archive does not include one, so dependency resolution must not be assumed reproducible from this ZIP alone.
- NSE's undocumented public endpoint is opt-in and disabled by default. Review current terms before enabling automated access or redistribution.
- Data fields that the provider does not supply remain undisclosed. GMP is unofficial and should not be treated as an exchange quote.

A completely bug-free build cannot be certified without the full dependency-backed build, unit tests, and deployment checks succeeding in the project's real environment.
