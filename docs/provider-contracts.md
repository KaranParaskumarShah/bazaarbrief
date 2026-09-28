# Bazaar Brief provider contracts

All six endpoints below must be live API endpoints. Do not point them at repository JSON files.

## IPO_JSON_URL
`{"mainboard": [...], "sme": [...]}`

Each IPO object should include at least: `name, slug, type, status, open, close, allotment, refund, credit, listing, band, lot, min, issue, fresh, ofs, subscription, qib, nii, retail`.

## GMP_JSON_URL
Array of patches keyed by `slug`, `symbol`, or `name` with `gmp`, `gmpUpdated`, and `gmpSource`.

## FIIDI_JSON_URL
`{"fii": number, "dii": number, "date": string, "source": string}` or `{ "fiiDii": {...} }`.

## STOCKS_JSON_URL
`{"stocks": [{"symbol":"...","name":"...","price":123,"pct":1.2}]}`.

## NEWS_JSON_URL
`{"news": [{"title":"...","tag":"...","source":"...","age":"..."}]}`.

## Direct metal endpoints (optional)
`GOLD_INR_URL` should return `{value, pct, asOf, source}` where value is INR per 10g.
`SILVER_INR_URL` should return `{value, pct, asOf, source}` where value is INR per kg.
If omitted, the refresh job derives live INR display values from live XAU/USD, XAG/USD and USD/INR API quotes; it does not use stored values.
