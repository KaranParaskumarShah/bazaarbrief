# BazaarBrief

Premium Indian market intelligence dashboard with a shared API-only data feed.

## Data model

The browser reads `/data/latest.json`. It does not call financial providers per visitor.

| Area | Source | Schedule |
|---|---|---|
| NIFTY 50 / BANK NIFTY | NSE public feed + EOD | Hourly 10:00-17:00 IST Mon-Fri |
| SENSEX | BSE public feed + EOD | Hourly 10:00-17:00 IST Mon-Fri |
| FII/FPI + DII | NSE public report/API | Every 2 hours |
| IPO issue list | NSE public IPO endpoints | Every 2 hours |
| IPO full issue information | NSE Issue Information per symbol | Every 2 hours |
| IPO documents | NSE public links when exposed | Every 2 hours |
| GIFT Nifty | TradingView public scanner | Scheduled refresh |
| Gold / Silver | OroPocket India public rates | Scheduled refresh |
| Brent / WTI / Natural Gas | TradingView public scanner | Scheduled refresh |
| Global indices / USD-INR | Yahoo public chart feed | Scheduled refresh |

## IPO strategy

The current IPO release is deliberately **NSE-first**. It fetches the whole issue list and then opens the detailed NSE Issue Information record for every discovered IPO. The raw NSE fields are preserved in `ipo.details` so the UI can show an IPO-portal-style comprehensive page.

GMP is intentionally deferred to a later provider integration. IPO publishing does not depend on GMP.

## GitHub Actions

The workflow is `.github/workflows/refresh-data.yml`.

No financial API secret is required. `GIFT_NIFTY_SYMBOL` is optional.

## Local validation

```bash
node --check scripts/refresh-data.mjs
```

A production Vite build requires installing the npm dependencies first.
