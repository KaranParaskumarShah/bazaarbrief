# Bazaar Brief — Shared Data Cache Architecture

This version keeps the **website frontend-only for visitors**. Visitors never call Twelve Data, IPO, GMP, FII/DII or news providers directly.

## Data flow

```text
Financial providers
      |
      | one scheduled refresh every 2 hours
      v
GitHub Action: scripts/refresh-data.mjs
      |
      v
public/data/latest.json
      |
      | one shared read per visitor/browser refresh
      v
Bazaar Brief React UI
```

The GitHub Action replaces `public/data/latest.json` every two hours. All visitors see the same latest shared dataset. The React app only reads that JSON file and stores the last successful copy locally as a fallback.

## Configure the refresh job

GitHub → Repository → Settings → Secrets and variables → Actions.

### Required for market data

Add secret:

- `TWELVE_DATA_KEY`

Twelve Data supports batched quote requests, so the refresh job makes one batched market request for the configured symbols. Note: batching reduces HTTP requests but each symbol still consumes provider credits.

### IPO / GMP / FII-DII / News

Add normalized JSON endpoint secrets:

- `IPO_JSON_URL`
- `GMP_JSON_URL`
- `FIIDI_JSON_URL`
- `NEWS_JSON_URL`

The endpoints should return the shapes already used by the UI. This is intentional: the scheduled worker is the only place that knows provider credentials/URLs; the browser never receives them.

### GIFT Nifty

Set repository variable `GIFT_NIFTY_SYMBOL` to a symbol supported by your selected provider. If your provider does not expose GIFT Nifty, use a dedicated normalized feed in your own `GIFT_NIFTY_JSON_URL` adapter before publishing. The UI will never silently label NIFTY spot as GIFT Nifty.

## Schedule

The GitHub Action runs at:

`0 */2 * * *`

It can also be run manually from the Actions tab.

## Visitor behavior

- Initial page load: fetch `/data/latest.json` once.
- Every 2 hours while open: fetch `/data/latest.json` again.
- Manual Refresh: reads the shared JSON again; it does **not** call financial APIs.
- If the shared file is temporarily unavailable, the browser keeps its last successful copy.

## Important

A browser's localStorage is per-user and cannot be a shared cache. The shared JSON file is therefore the common source for all visitors. This is the part that prevents 1,000 visitors from making 1,000 provider calls.

GMP is displayed as unofficial / market-reported and should carry its source and timestamp. Official IPO/subscription information should be verified against exchange/registrar documents.


## Vercel deployment

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Vercel builds with `npm run build`.
4. Configure the GitHub Actions secrets/variables listed above.
5. The scheduled Action updates `public/data/latest.json` and pushes the new file.
6. The Git push triggers a new Vercel deployment, so all visitors receive the same refreshed dataset.

The browser never receives provider API keys. Manual refresh in the UI only reads the shared JSON; it never calls the upstream financial providers.
