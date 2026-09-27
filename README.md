# Bazaar Brief

Frontend-only React/Vite market and IPO dashboard for bazaarbrief.in.

## Architecture

There is **no backend, API route, database, cron job, or server function** in this project.

The browser fetches live data directly from configured browser-safe providers.

### Refresh behavior

- Fetches fresh data when the page first opens.
- Stores the latest successful response in `localStorage`.
- Reuses the cache only while it is less than 2 hours old.
- Automatically fetches again every 2 hours while the page/tab is open.
- Re-checks freshness when the tab becomes visible again.
- Includes a manual **Refresh now** button.
- Never falls back to the old hard-coded FII/DII JSON.
- Every response carries an `updatedAt` timestamp shown in the header.

A frontend-only application cannot execute a refresh while nobody has opened the website. For background refresh with no visitors, a backend/serverless job would be required.

## Data providers

### Market data — Twelve Data

Set:

`VITE_TWELVE_DATA_KEY=your_key`

The key is intentionally a frontend variable. `VITE_*` variables are included in the browser bundle, so use a provider plan/key that permits browser-side requests and CORS.

The dashboard requests indices, tracked Indian stocks, global indices and commodity symbols in one batch quote request.

### USD/INR — Frankfurter

No key is required.

### IPO — FinAPI public feed

The project uses the public IPO feed directly from the browser. Provider availability can change; unavailable fields are shown as `—` rather than old data.

### News — GDELT

The project uses the public GDELT news index so headlines are fetched instead of being stored in a stale local JSON file.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Vercel

Add the environment variable in the Vercel project settings:

```text
VITE_TWELVE_DATA_KEY=...
```

Then redeploy. No backend configuration or Vercel Cron configuration is required.

## Routes

- `/` — market dashboard
- `/ipo` — IPO hub
- `/ipo/<company-slug>` — IPO detail
- `/ipo-calendar` — IPO calendar
- `/gmp` — IPO GMP tracker
- `/ipo-allotment-status` — allotment/listing status
- `/tools` — financial tools

## Data freshness

Bazaar Brief does not claim that a two-hour browser refresh makes an underlying provider real-time. Each provider can have its own market-data delay, trading-session rules, plan limits and publication schedule. The UI therefore displays provider timestamps where available and avoids inventing missing values.
