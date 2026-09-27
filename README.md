# Bazaar Brief

Frontend dashboard for bazaarbrief.in — commodity prices (with USD→INR conversion), FII/DII
flows, and India stocks grouped by theme (data center, defence, semiconductor, water recycling,
mining, AI & robotics).

## Run it

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

The `dist/` folder is what you upload to your host (Vercel, Netlify, Hostinger, etc. all work
since this is a static frontend — no server needed).

## Live data — what's on by default vs what needs a key

No signup required, on by default:
- **Gold** (goldprice.dev)
- **Brent crude** (ukoilwatch.com)
- **USD → INR rate** (open.er-api.com), used to convert every commodity to rupees

Needs a free API key (no card required) — paste it into `src/config.js`:
- **Silver / Copper** → key from https://metalpriceapi.com/
- **Crude oil (WTI)** → key from https://www.oilpriceapi.com/
- **Stock prices** (all 36 tickers in Sector Watch) → key from https://twelvedata.com/
  (free tier: 800 calls/day, refresh interval is set to 60s in `src/config.js` — raise it if
  you hit the limit with this many tickers)

Until a key is added, that card/tile shows "needs a free API key" instead of guessing a number.

## FII/DII data

NSE/NSDL don't publish a free public API for daily FII/DII cash-market flows, and scraping their
site from the browser breaks on CORS and their terms of service. `src/data/fiiDii.json` is a
manually-updated file — update it by hand each evening from the official NSDL FPI report. If you
later add a backend, that's the natural place to automate this (e.g. a scheduled job that reads
the official report and writes to this file or a small database).

## Editing the stock lists

`src/data/stockCategories.js` — add, remove, or re-theme any ticker. Symbols use the `.NS` suffix
Twelve Data expects for NSE-listed stocks.

## Structure

```
src/
  config.js               API keys + endpoints, edit this first
  data/
    stockCategories.js    the 6 sector lists
    fiiDii.json            manually-updated FII/DII numbers
  services/api.js          all fetch logic in one place
  hooks/usePolling.js       fetch-on-load + refresh-every-60s hook
  components/               UI pieces (Masthead, TickerStrip, cards, sections)
```
