# Bazaar Brief — API-only shared data

This build intentionally has **no financial snapshot fallback** in the refresh pipeline.

## Architecture

Financial provider APIs -> GitHub Actions (every 2 hours) -> `public/data/latest.json` -> Vercel/static frontend -> all visitors.

Visitors never call financial providers directly.

## Required API configuration

Set GitHub Actions secrets/variables:

- `TWELVE_DATA_KEY` (secret)
- `GIFT_NIFTY_SYMBOL` (variable; required if your Twelve Data plan exposes GIFT Nifty under a specific symbol)
- `IPO_JSON_URL` (secret)
- `GMP_JSON_URL` (secret)
- `FIIDI_JSON_URL` (secret)
- `NEWS_JSON_URL` (secret)
- `STOCKS_JSON_URL` (secret)

Optional:

- `GOLD_INR_URL`
- `SILVER_INR_URL`

The normalized endpoints must return live API JSON. Do not point them at checked-in JSON files.

### Expected normalized formats

IPO:
```json
{"mainboard":[...],"sme":[...]}
```

GMP:
```json
[{"slug":"moneyview-ipo","gmp":12,"gmpUpdated":"2026-09-28T12:00:00Z","gmpSource":"Provider"}]
```

FII/DII:
```json
{"fii":-1234.5,"dii":2345.6,"date":"2026-09-28","source":"Provider"}
```

News:
```json
{"news":[{"title":"...","tag":"MARKET","source":"Provider","age":"2h"}]}
```

## Commodity units

- Gold: ₹/10g
- Silver: ₹/kg
- Brent: $/bbl
- WTI: $/bbl
- Natural Gas: $/MMBtu
- USD/INR: ₹ per USD

Gold and silver use direct INR API feeds when configured. Otherwise they are derived from **live** XAU/XAG spot and **live** USD/INR in the same refresh; they are never taken from the old checked-in snapshot.

## Important behavior

If any required API is unavailable or returns invalid data, `refresh-data.mjs` exits non-zero and does **not** overwrite `latest.json`. This prevents stale data from being labelled as current. The previous file may remain on the site until the next successful run; its timestamp/source remains visible. For strict no-stale publishing, configure the deployment to fail/stop when the refresh job fails.
