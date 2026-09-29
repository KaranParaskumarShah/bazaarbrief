# BazaarBrief clean architecture

## 1. Provider adapters

`scripts/refresh-data.mjs` is the only provider layer. Provider-specific URLs and response parsing stay there.

Every provider result is normalized before it enters the shared schema:

```text
provider response
    ↓
adapter / normalizer
    ↓
value + change + timestamp + source
    ↓
shared dataset
```

## 2. Refresh orchestrator

GitHub Actions runs every 10 minutes. Independent providers use `Promise.allSettled`, so an unavailable provider does not erase unrelated successful data.

The workflow commits only when `public/data/latest.json` changes.

## 3. Shared dataset

`public/data/latest.json` is the only financial-data input used by the browser.

A successful refresh replaces the dataset with newly fetched API data. No provider response is copied into the React source code.

## 4. Frontend

`src/main.jsx`:

- reads `/data/latest.json`;
- checks it every 60 seconds;
- checks again when the tab becomes visible;
- never sends provider requests;
- never receives provider credentials.

## 5. Provider map

### Indian markets

- NIFTY 50: NSE public market feed.
- BANK NIFTY: NSE public market feed.
- SENSEX: BSE public market feed.
- Indian stocks: NSE NIFTY 50 constituents feed.

No secondary community stock feed is used.

### Final closes

After the Indian cash-market session, the collector requests historical EOD data from NSE/BSE. A quote is labelled `FINAL CLOSE` only after that EOD response succeeds.

### Global / commodities

Yahoo public chart feed is used consistently for global indices, USD/INR and energy contracts. Provider timestamps are retained.

### Metals

Gold-API supplies XAU/XAG USD spot prices. The dashboard uses the same Yahoo USD/INR quote for the INR equivalent, avoiding a second FX provider with a different timestamp.

### GIFT Nifty

TradingView public scanner is used for the NSE International Exchange continuous GIFT Nifty futures symbol. It is shown as a futures indicator, not as NIFTY 50 spot.

### IPOs

FinAPI's free IPO endpoint is the primary no-key issue-data source. NSE public IPO endpoints are optional enrichment only. GMP Today supplies GMP/subscription enrichment.

### News

Google News RSS supplies headlines only.

## 6. Failure behavior

Provider failure → omit that provider's data → record the error → continue with independent providers.

If there is not enough usable API data to publish a meaningful dataset, the refresh exits non-zero and does not overwrite the previous valid file with an empty dataset.

The frontend does not fabricate a replacement value.

## 7. Visitor traffic

```text
100,000 visitors
       ↓
100,000 reads of latest.json
       ↓
0 provider calls from visitors
       ↓
~144 scheduled provider refresh cycles/day
```

The refresh frequency is therefore independent of website traffic.
