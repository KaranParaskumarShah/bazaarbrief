# BazaarBrief — free API-only market + IPO feed

BazaarBrief is a static React/Vite market-information site. The browser never calls financial providers directly. GitHub Actions collects public/free API data and writes `public/data/latest.json`; Vercel serves the static site.

## Refresh architecture

- GitHub Actions: every 10 minutes.
- Browser: checks the shared JSON about every 60 seconds.
- No paid API keys are required.
- No bundled financial snapshots are used.
- If a provider fails, that field is omitted and the error is recorded. The refresh is not failed merely because one provider is blocked.
- If virtually no provider returns usable data, the workflow fails and the previous valid dataset is left untouched.

## IPO priority

IPO data uses free, no-key sources: **FinAPI free IPO endpoint**, **GMP Today public dataset/API**, and **NSE public IPO endpoints when reachable**. GMP Today publishes a machine-readable dataset refreshed during the day. GMP is unofficial and is clearly labelled as such.

The collector normalizes multiple field names for price band, lot size, issue size, dates, subscription, GMP and board type, then merges sources by normalized company name. Open IPOs are shown before upcoming IPOs.

## Gold / silver

Gold and silver use public spot data in USD/troy oz and calculate an INR equivalent using the same USD/INR feed used by the dashboard. The UI shows both USD/oz and INR/10g or INR/kg. It is spot-equivalent pricing, not a local jewellery/retail quote.

## Market close accuracy

For NIFTY 50, BANK NIFTY and SENSEX, the collector attempts to switch from intraday exchange quotes to exchange historical EOD close after the Indian cash session. It never replaces a failed EOD lookup with a fabricated value.

## GIFT Nifty

GIFT Nifty is displayed as a futures/pre-market indicator using the public market scanner where available. It is not labelled as NIFTY 50 spot.

## Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Validate refresh script:

```bash
npm run validate
```
