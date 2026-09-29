# BazaarBrief — Static React frontend + scheduled shared market API feed

BazaarBrief is a static Vite/React site. The browser does **not** call financial providers directly and no provider API key is shipped to visitors.

## Architecture

```text
Official/public providers
       │
       │ scheduled fetch
       ▼
GitHub Actions (every 10 minutes)
       │
       ├── NSE India → NIFTY 50 / BANK NIFTY / stock feed / FII-DII / IPO fallback
       ├── BSE India → SENSEX
       ├── IPO Guru → active IPO + GMP + subscription (free key)
       ├── Yahoo Finance → global indices / USD-INR / Brent / WTI / Natural Gas
       ├── XAUS → INR gold/silver spot
       ├── TradingView scanner → GIFT Nifty fallback/indicator
       └── Google News RSS → market/news headlines
       │
       ▼
public/data/latest.json
       │
       ▼
Static React/Vite frontend
       │
       └── browser checks shared JSON every 60 seconds
```

This keeps the site frontend/static while giving it an automatically refreshed shared dataset. There are **no per-visitor provider calls** and no bundled financial-value snapshots.

## Refresh cadence

- GitHub Actions: every **10 minutes**.
- Browser: checks the shared JSON every **60 seconds** and immediately checks again when the tab becomes visible.
- GitHub scheduled jobs can occasionally start late because GitHub controls scheduled-job execution. The `updatedAt` field in `public/data/latest.json` is the authoritative freshness timestamp.
- If a provider fails, BazaarBrief does not invent a value or silently reuse an old financial snapshot.

## API key setup

The only required optional key is for IPO Guru's IPO/GMP/subscription enrichment.

1. Request a free IPO Guru API key from the provider.
2. In GitHub open:
   `Settings → Secrets and variables → Actions → New repository secret`
3. Create:

```text
IPOGURU_API_KEY = your_actual_key
```

4. Optional repository variable:

```text
GIFT_NIFTY_SYMBOL = NIFTY1!
```

The secret is only available to the GitHub Actions refresh job. **Do not put the real key in React, `main.jsx`, `public/`, `latest.json`, or a committed `.env` file.**

IPO Guru documents a free REST API with 300 requests/day and 15 requests/minute. This build uses **one `/ipos` request per scheduled run**, so a 10-minute cadence is 144 scheduled requests/day, leaving room for manual runs. See the provider documentation for current limits and commercial-use terms.

## Run locally

```bash
npm install
npm run dev
```

Validate the refresh script:

```bash
npm run validate
```

Build the static site:

```bash
npm run build
```

## First production refresh

After pushing the repository:

1. Open **Actions**.
2. Select **Refresh Bazaar Brief shared data**.
3. Click **Run workflow** once.
4. Confirm the job succeeds.
5. Open `public/data/latest.json` and confirm `refresh.status` is `ok` and `updatedAt` is recent.
6. Deploy the same repository to Vercel.

After that, the scheduled workflow keeps replacing `latest.json` with the newest successful API result.

## Data integrity rules

- No hard-coded market prices.
- No fake chart/sparkline values. Sparklines are rendered only when the API supplies a real price series.
- Every quote carries provider/source information and, when the provider exposes it, the provider's actual timestamp.
- Gold and silver are direct INR spot-equivalent values from the metal provider, not Indian retail/jewellery rates.
- Brent/WTI/Natural Gas are market futures/commodity quotes, not Indian retail fuel prices.
- GIFT Nifty is a futures/pre-market indicator and may be delayed. It is never presented as NIFTY 50 spot.
- GMP is unofficial/market-reported and is explicitly labelled as such.
- A stale precious-metal response is rejected rather than published as if it were live.

## Important limitation

Free public feeds cannot guarantee licensed exchange-grade tick-by-tick real-time redistribution. NSE's own market-live page describes its web market data as approximately 1–3 minutes behind trading in some views. TradingView also states that exchange real-time redistribution on its public widgets is subject to exchange licensing and that website data can be delayed. Therefore the UI uses source-specific freshness labels rather than claiming every number is tick-by-tick real-time.
