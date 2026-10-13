# Data sources, cadence and compliance

| Dataset | Current adapter | Refresh | Important limitation |
|---|---|---:|---|
| Indian indices | Yahoo Finance chart endpoint | 15 min | Undocumented endpoint; not a licensed official API. Review terms and redistribution rights before public/commercial display. |
| Gold/silver futures, Brent, USD/INR | Yahoo Finance chart endpoint | 15 min | Futures/reference prices, not necessarily Indian retail/MCX spot prices. Not a substitute for licensed data. |
| Headlines | RSS feed parser | 15 min | Headline/summary only; link to publisher; feed terms and attribution apply. |
| IPOs | NSE public website endpoints (`ipo-current-issue`, `all-upcoming-issues`, `public-past-issues`); optional `IPO_DATA_URL` override | 15 min | Undocumented endpoints may block automated access or change. No fake fallback; redistribution permissions must be checked. |
| FII/DII | NSE public `fiidiiTradeReact` endpoint; optional `FII_DII_DATA_URL` override | 15 min | Undocumented endpoint may block automated access or change. Appends/deduplicates actual date rows only; no fake history. |

## Required source schema

- Quotes: array of `{ symbol, name, value, change, changePct, updatedAt, source }`.
- IPOs: array of `{ id, name, symbol, market, status, openDate, closeDate, priceBand, lotSize, issueSize, gmp?, subscription?, listingDate?, description? }`.
- FII/DII: array of `{ date, fii, dii }` where flows are INR crore.
- News is normalized by the Worker from RSS XML and emits `{ id, title, summary, source, category, publishedAt, url }`.

## Compliance notes

NSE terms prohibit automated data collection without authorization, and NSE data-sharing policy governs use and redistribution. See:
- https://www.nse.in/static/nse-terms-of-use
- https://www.nseindia.com/static/market-data/nse-data-policy

Do not scrape NSE/BSE or republish data just because an endpoint is technically reachable. Obtain written permission or use a vendor whose contract allows public display and redistribution. Yahoo Finance chart access is unofficial and not guaranteed for this purpose; replace it with a permitted source before commercial use. Free tiers often prohibit redistributing market data.
