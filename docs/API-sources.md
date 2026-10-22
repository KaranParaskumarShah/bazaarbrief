# Data sources, cadence and compliance

| Dataset | Current adapter | Refresh | Important limitation |
|---|---|---:|---|
| Indian indices | Yahoo Finance chart endpoint | 15 min | Undocumented endpoint; not a licensed official API. Review terms and redistribution rights before public/commercial display. |
| Gold/silver futures, Brent, USD/INR | Yahoo Finance chart endpoint | 15 min | Futures/reference prices, not necessarily Indian retail/MCX spot prices. Not a substitute for licensed data. |
| Headlines | RSS feed parser | 15 min | Headline/summary only; link to publisher; feed terms and attribution apply. |
| IPOs | Xflot public IPO JSON API (`https://www.xflot.com/api/public/market/ipos?limit=200`); optional `IPO_DATA_URL` override | 15 min | The API documents free/no-key use, attribution, a required disclaimer and polling no more than once/minute. Cron polls every 15 minutes. GMP remains unofficial and source freshness may be limited. Visitor requests only read the shared snapshot. |
| FII/DII | NSE public `fiidiiTradeReact` endpoint; optional `FII_DII_DATA_URL` override | 15 min | Undocumented endpoint may block automated access or change. Appends/deduplicates actual date rows only; no fake history. |

## Required source schema

- Quotes: array of `{ symbol, name, value, change, changePct, updatedAt, source }`.
- IPOs: array of `{ id, name, symbol, market, status, openDate, closeDate, priceBand, lotSize, issueSize, gmp?, subscription?, listingDate?, description? }`; additional source, GMP freshness, registrar and offer-document fields are optional.
- FII/DII: array of `{ date, fii, dii }` where flows are INR crore.
- News is normalized by the Worker from RSS XML and emits `{ id, title, summary, source, category, publishedAt, url }`.

## Compliance notes

NSE terms prohibit automated data collection without authorization, and NSE data-sharing policy governs use and redistribution. See:
- https://www.nse.in/static/nse-terms-of-use
- https://www.nseindia.com/static/market-data/nse-data-policy

Do not scrape NSE/BSE or republish data just because an endpoint is technically reachable. Obtain written permission or use a vendor whose contract allows public display and redistribution. Yahoo Finance chart access is unofficial and not guaranteed for this purpose; replace it with a permitted source before commercial use. Free tiers often prohibit redistributing market data.


## IPO detail enrichment

BazaarBrief uses the documented Xflot public IPO list endpoint and, no more than once every six hours, enriches up to 20 issues from the documented per-IPO endpoint. This supplies reported GMP observations and category subscription where returned. It is not a substitute for audited prospectus financials, complete daily subscription snapshots, registrar contacts, or every investor quota. Those fields remain unavailable unless the selected feed provides them. GMP is unofficial and the Xflot attribution/disclaimer must remain visible.


## IPO enrichment and optional public-feed adapters (October 2026)

- **Primary IPO list:** `IPO_DATA_URL` (default: Xflot public IPO list). The Worker normalizes records, merges the previous successful snapshot to preserve useful fields, and writes the shared KV snapshot. The browser does not call upstream providers directly.
- **Per-IPO detail/GMP:** `IPO_DETAIL_BASE_URL` (defaults to the documented Xflot detail endpoint when the primary URL is Xflot). Enrichment is capped at 20 selected issues per six-hour window and uses low concurrency. The documented detail feed may supply GMP history and category subscription; it does not guarantee audited financial statements, daily subscription snapshots, issue quotas, registrar contacts or offer documents.
- **Optional secondary provider:** set `IPO_SECONDARY_DATA_URL` to a normalized JSON endpoint returning an array, `{"data":[]}` or `{"ipos":[]}`. Only configure a provider that explicitly permits automated retrieval, caching and public display. Secondary provider errors do not interrupt the primary feed.
- **Optional NSE public endpoint:** set `NSE_IPO_ENABLED=true` after reviewing NSE's current website/data terms for the intended commercial redistribution. The Worker primes a cookie from `https://www.nseindia.com/` and requests `/api/ipo-current-issue` with browser-like headers. This is an undocumented public website endpoint, not a contractual API; bot protection, response shape and availability can change. It is disabled by default and failures are isolated.
- **Cache policy:** the scheduled Worker refreshes the central list every 15 minutes; the public API returns the shared snapshot. KV's long retention preserves the last known good snapshot through upstream outages; this retention is not a claim that every field is fresh. Detail enrichment has a six-hour throttle. GMP and subscription values retain provider timestamps when supplied and must be treated as unofficial/delayed. Completed IPOs remain in the retained snapshot; the UI labels absent fields instead of deriving facts from missing values.
- **Data limitations:** no verified free source was assumed to provide every field. Financial statements, RHP/DRHP links, registrar status portals, quota allocation and day-wise subscription remain absent unless a configured provider supplies them. Do not infer these from company names or unrelated feeds. `subscription` remains the legacy total-subscription multiple for backward compatibility; normalized category data is represented as `subscriptionDetails`.
