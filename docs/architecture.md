# BazaarBrief production architecture

## Goal

Keep BazaarBrief a static React/Vite website while avoiding exposed API keys, per-user provider calls, hard-coded financial snapshots and provider timestamp mixing.

## Layers

### Layer 1 — Provider adapters

`scripts/refresh-data.mjs` is the only place that knows provider URLs and provider-specific response shapes.

Each provider is normalized into the same internal quote/IPO model:

```text
Provider response
    ↓
provider adapter
    ↓
normalized value + change + provider timestamp + source + optional series
```

### Layer 2 — Refresh orchestrator

GitHub Actions runs the refresh script every 10 minutes.

The orchestrator uses independent `Promise.allSettled` calls so one failing provider does not destroy unrelated data. The dataset is published when at least a small amount of usable API data is available. One provider failure never blocks the entire refresh. If essentially all providers fail, the script exits without replacing the previous valid dataset.

The job uses a concurrency lock so two refresh jobs do not publish at the same time.

### Layer 3 — Shared dataset

`public/data/latest.json` is the single source consumed by the browser.

A successful refresh replaces the complete dataset. It is not a rolling merge with the previous financial snapshot.

Each published value should contain:

- value
- change / percentage change where available
- provider source
- provider timestamp when available
- optional real price series

### Layer 4 — Static frontend

`src/main.jsx` only reads `/data/latest.json`.

The browser:

- checks the shared file every 60 seconds
- checks again when the tab becomes visible
- never receives provider credentials
- never directly calls NSE/BSE/Yahoo/FinAPI/GMP Today

### Layer 5 — Vercel/static hosting

Vercel only serves the static application and `latest.json`.

No database and no application server are required for the current product.

## Source priority

| Data | Primary | Fallback | Notes |
|---|---|---|---|
| NIFTY 50 | NSE | Yahoo | Exchange source preferred; after cash close use NSE EOD close |
| BANK NIFTY | NSE | Yahoo | Exchange source preferred; after cash close use NSE EOD close |
| SENSEX | BSE | Yahoo | BSE source preferred; after cash close use BSE EOD close |
| Indian stocks | NSE | community API | Fallback is only used when NSE stock rows are insufficient |
| FII/DII | NSE | none | Missing data stays missing |
| IPO details | FinAPI free IPO feed + NSE when reachable | GMP Today | No API key; normalize and merge by company name |
| GMP/subscription | GMP Today | raw GitHub copy of same free dataset | Unofficial; source/update time shown |
| Global indices | Yahoo | TradingView | Provider timestamp is preserved |
| USD/INR | Yahoo | Frankfurter/TradingView | Quote timestamp is preserved |
| Brent/WTI/Natural Gas | Yahoo | TradingView | Futures/commodity quote |
| Gold/Silver | Gold-API USD spot | none | Shows USD/troy oz and calculated INR equivalent; timestamps are preserved |
| GIFT Nifty | TradingView / Yahoo fallback | none | Futures indicator; can be delayed |
| News | Google News RSS | none | Headlines only |

## No-snapshot rule

The financial refresh layer does not use Snapdata, bundled market prices, or any packaged financial snapshot. If a provider fails, that field remains unavailable and the error is recorded. The refresh continues for independent providers. If essentially all providers fail, the existing valid dataset is left untouched.

## Why not call APIs directly from React?

A purely browser-direct design would expose API keys and multiply provider traffic by the number of visitors. It also makes CORS, rate limits and provider blocking a client-side problem.

The shared-feed pattern gives:

```text
100,000 visitors
       ↓
100,000 requests to latest.json
       ↓
0 provider calls from visitors
       ↓
~144 scheduled refreshes/day
```

The provider request volume is therefore independent of traffic.

## Why 10 minutes?

The zero-key IPO layer uses public GMP Today data plus public NSE IPO endpoints, so no provider secret is required. The refresh cadence is 10 minutes; the browser checks the shared file every 60 seconds.

For an even tighter live requirement, a paid/licensed exchange feed can replace the relevant adapter later. The frontend schema does not need to change.
