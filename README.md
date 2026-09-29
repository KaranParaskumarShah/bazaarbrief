# BazaarBrief — Clean Free API Architecture

BazaarBrief is a static React/Vite market-information website. The browser reads one shared JSON file and never calls financial providers directly.

## Data flow

```text
Free public/exchange providers
        ↓
GitHub Actions refresh every 10 minutes
        ↓
public/data/latest.json
        ↓
Vercel / static hosting
        ↓
React dashboard
```

### No API keys

The current collector requires **no paid API and no API secret**.

The only optional GitHub repository variable is:

```text
GIFT_NIFTY_SYMBOL=NIFTY1!
```

That is a public instrument symbol, not a secret.

## Providers

| Data | Provider | Key | Policy |
|---|---|---:|---|
| NIFTY 50 | NSE public market feed | No | Exchange source only |
| BANK NIFTY | NSE public market feed | No | Exchange source only |
| SENSEX | BSE public market feed | No | Exchange source only |
| Final NIFTY/BANK close | NSE historical index data | No | Used after cash-market close |
| Final SENSEX close | BSE historical index data | No | Used after cash-market close |
| Indian stocks | NSE NIFTY 50 feed | No | No community fallback |
| GIFT Nifty | TradingView public scanner / NSEIX | No | Futures indicator |
| S&P 500 / NASDAQ 100 / FTSE / Hang Seng | Yahoo public chart | No | Provider timestamp retained |
| USD/INR | Yahoo public chart | No | Same quote used for metal INR conversion |
| Brent / WTI / Natural Gas | Yahoo public chart | No | Futures/commodity quote |
| Gold / Silver | Gold-API | No | USD spot + INR equivalent |
| IPO issue data | FinAPI free IPO endpoint | No | Primary free IPO feed |
| IPO official enrichment | NSE public IPO endpoints | No | Optional; failure does not block IPOs |
| GMP / subscription | GMP Today public dataset | No | Unofficial market-reported data |
| News | Google News RSS | No | Headlines only |

## IPO priority

IPO data is intentionally independent from the rest of the market refresh. If NSE web automation is blocked, the IPO feed can still publish from the free IPO provider + GMP Today.

The collector normalizes and merges records by normalized company name. Exchange-style fields are preferred from NSE when available; GMP/subscription fields are preferred from GMP Today.

GMP is always labelled unofficial.

## No static financial values

`public/data/latest.json` starts empty. It is populated only by a successful API refresh.

The collector does not contain a packaged market-price dataset and does not manufacture values when a provider fails. If a provider is unavailable, that field is omitted and the refresh is marked partial. If almost no API data is available, the job fails and does not write an empty replacement dataset.

## Market-close rule

During the Indian cash session, NIFTY 50, BANK NIFTY and SENSEX use exchange LTP data.

After the cash market close, the collector attempts to replace those intraday values with the exchange historical EOD close. The UI labels the value `FINAL CLOSE` only when an official EOD record was obtained.

This is specifically designed for the requirement that a final close should not be replaced by a random third-party quote later in the evening.

## Refresh cadence

- GitHub Actions: every 10 minutes.
- Browser: checks `latest.json` every 60 seconds and on tab visibility changes.
- Visitors never call financial providers.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Refresh-script syntax check:

```bash
npm run validate
```
