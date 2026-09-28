# Bazaar Brief — Free API Shared Data Build

This build removes the paid Twelve Data requirement and removes all financial snapshots from the production UI.

## Data architecture

GitHub Actions refreshes `public/data/latest.json` every 2 hours. Visitors only fetch that shared JSON file; they never call market providers directly.

## Free providers used by default

- Indian/global market quotes: Yahoo Finance public chart feed from the scheduled GitHub runner (unofficial/public endpoint; check commercial redistribution terms before relying on it commercially).
- Gold/Silver: Gold-API, no key, live USD/troy-ounce spot; converted to INR using the live USD/INR quote. Gold-API documents its no-key live feed and timestamped responses.
- FX: Frankfurter/ECB latest USD/INR reference rate.
- India index fallback: Snapdata, no key; daily Nifty 50/Nifty Bank/Sensex data. This is only a fallback for missing index quotes, never a bundled snapshot.
- FII/DII: NSE public endpoint, fetched by the scheduled job.
- News: Google News RSS, no key.
- IPO base data: IndianAPI public `/ipo` endpoint, no key.
- GMP/subscription enrichment: IPO Guru free API key, optional. Without a key, GMP is shown as unavailable rather than inventing/storing an old number.

## Why this is not described as "guaranteed live"

No free provider gives a licensed, guaranteed-real-time feed for every Indian index, GIFT Nifty, IPO subscription, GMP, global index and commodity at once. Some free feeds are delayed or unofficial. The dataset therefore carries provider/source and timestamps and the UI must never call a value live when its provider did not provide a current timestamp.

## Setup

1. Push the project to GitHub.
2. Run **Actions → Refresh Bazaar Brief shared data → Run workflow** once.
3. The scheduled workflow then runs every 2 hours.
4. Optional: add `IPOGURU_API_KEY` as a GitHub Actions secret for GMP/subscription enrichment. IPO Guru says its developer API is free with 300 requests/day and 15 requests/minute.
5. Deploy the same repository to Vercel.

## Build

```bash
npm install
npm run build
```

## Important

The app intentionally starts with an empty API-only dataset. It will display a waiting state until the scheduled refresh succeeds. It never falls back to a financial snapshot.
