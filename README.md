# Bazaar Brief (bazaarbrief.in)

News + market data + IPO center + financial tools. React 19 + Vite + react-router, no backend.

```bash
npm install
npm run dev      # local
npm run build    # generates sitemap.xml/robots.txt, then builds to dist/
```
Deploy `dist/` anywhere. `vercel.json` and `public/_redirects` (Netlify/Cloudflare) already
handle SPA routing so `/ipo/gmp` works on refresh.

## Live data (refreshes every 2 hours, see REFRESH_INTERVAL_MS in src/config.js)
| Data | Source | Key? |
|---|---|---|
| Gold, Silver | goldprice.dev | No |
| Brent | ukoilwatch.com | No |
| WTI | americasoilwatch.com | No |
| USD/INR | open.er-api.com | No |
| Copper | metalpriceapi.com | Free key -> `METALPRICE_KEY` |
| Stocks + all indices (Nifty, Sensex, Bank Nifty, Nasdaq, S&P, Dow) | twelvedata.com | Free key -> `TWELVE_DATA_KEY` |

Note: Brent/WTI providers refresh roughly daily/intraday, so a 2-hour poll is already fresh.
Free tier of Twelve Data is 800 calls/day: ~45 tickers x 12 polls/day = 540, fits. Index symbols
(NIFTY50.NS, SENSEX.BSE, ...) may need adjusting to what your Twelve Data plan supports.

## Manually maintained data (no free API exists)
- `src/data/ipos.js` - ALL IPO data. Currently fictional placeholders. Replace with real figures
  from RHP + NSE/BSE circulars. GMP is always unofficial.
- `src/data/fiiDii.json` - daily FII/DII, from NSDL/NSE reports.
- `src/data/marketHighlights.json`, `src/data/newsItems.json` - daily bullets, gainers/losers, news.
- Natural gas price is not wired (no free keyless source).

## Adding an IPO
Copy an entry in `src/data/ipos.js`, change `slug`. Page appears at `/ipo/<slug>`, in the
calendar, GMP table, allotment table and sitemap automatically.

## Tools
`src/data/calculators.js` (16 calculators, one generic page) and `src/data/marketTools.js`.
Add an object to the array and a new `/tools/<slug>` page exists.

## SEO - important
This is a client-rendered SPA. Google can index it but slowly and less reliably than server-rendered
HTML, and titles/meta are set by JS. Since organic traffic is the goal, the next step should be
prerendering (static HTML per route) or moving to Next.js/Astro. Data files are already plain JS
modules, so migration is straightforward. Also add JSON-LD structured data for IPO pages then.
