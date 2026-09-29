# Bazaar Brief (bazaarbrief.in)

News + market data + IPO center + financial calculators. React 19 + Vite + react-router, no
backend, light/premium theme.

```bash
npm install
npm run dev      # local
npm run build    # generates sitemap.xml/robots.txt, then builds to dist/
```
Deploy `dist/` anywhere. `vercel.json` and `public/_redirects` (Netlify/Cloudflare) already
handle SPA routing so `/ipo/gmp` works on refresh.

## What changed in this pass
1. **Fixed gold & silver** — the goldprice.dev endpoint was wrong the whole time
   (`/v1/prices?symbol=...` doesn't exist; the real one is `/v1/spot/XAU-USD-SPOT`, returning a
   flat object, not `{symbols:[...]}`). Fixed against goldprice.dev's own docs.
2. **Removed everything that needed a stock/index data key** — Sector Watch, Nifty/Sensex/Bank
   Nifty, Nasdaq/S&P/Dow. All of it showed "Needs a key" and added nothing without a paid-ish
   signup. Deleted, along with the unused code behind it.
3. **Added stock & IPO calculators in that space instead** — the homepage now links every
   calculator directly under "Stock Calculators" and "IPO Calculators". No API, no key, always
   works.
4. **Live news, real feed, every 2 hours** — `src/services/news.js` fetches and parses the
   Economic Times Markets RSS feed client-side (top 8 items), through the same CORS-relay
   fallback as the price data, cached the same way. Falls back to `src/data/newsItems.json` if
   it's never fetched successfully on a given browser.

## Data flow
- Every successful fetch is saved to **localStorage** with a timestamp.
- Every page load shows the **stored value immediately** — no blank flash.
- It only refetches once a value is older than **2 hours** (`REFRESH_INTERVAL_MS` in `src/config.js`).
- A failed refetch keeps showing the last good value instead of going blank.
- Price cards show "Updated Xm ago".

## Design
Light, premium theme — ivory page background, white cards with a soft shadow, a deep navy
masthead/nav bar, muted gold accent. Tokens in `src/index.css`.

## Live data
| Data | Source | Key? |
|---|---|---|
| Gold, Silver | goldprice.dev | No |
| Brent | ukoilwatch.com | No |
| WTI | americasoilwatch.com | No |
| USD/INR | open.er-api.com | No |
| Markets news (top 8) | Economic Times RSS | No |
| Copper | metalpriceapi.com | Free key → `METALPRICE_KEY` |

## What I could not verify from here
No browser to test in, so two things are my best implementation rather than confirmed-working:
- The **CORS relay** (`allorigins.win`) actually getting through in your browser. If a
  commodity card still won't load, tell me which one.
- The **RSS parsing** — couldn't fetch the feed's raw XML from this environment to check exact
  tag names, so `services/news.js` parses it as standard RSS 2.0. If headlines don't show up,
  open the feed URL in a browser tab and compare its tags to what `fetchLatestNews()` reads.

## Manually maintained (no free API exists for these)
- `src/data/ipos.js` — all IPO data is fictional placeholder data. Replace with figures from
  each company's RHP and NSE/BSE circulars before publishing. GMP is always unofficial.
- `src/data/fiiDii.json` — daily FII/DII, update from NSDL/NSE reports.
- `src/data/marketHighlights.json` — daily bullets.
- Natural gas price isn't wired up — no free keyless source was found.

## Known limitation — the CORS relay
`allorigins.win` has no uptime guarantee. Fine for personal use; for production, a small
serverless function (Vercel/Netlify Function) that fetches server-side is the durable fix.

## Adding an IPO / a tool
- IPO: copy an entry in `src/data/ipos.js`, change `slug`. Appears everywhere automatically.
- Calculator: add an object to `src/data/calculators.js` — `/tools/<slug>` exists immediately.
- Live-data tool: add an object to `src/data/marketTools.js`.

## SEO
This is a client-rendered SPA. Google can index it, but less reliably than server-rendered HTML.
If organic search is central to the plan, prerendering each route (or moving to Next.js/Astro)
is the next real step.
