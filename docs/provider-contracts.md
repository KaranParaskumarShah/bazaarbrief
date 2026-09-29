# Provider contracts

## IPO
- FinAPI: `https://finapi.upvaly.com/api/ipo` — free tier endpoint advertised without signup/key; used for current IPO issue data.
- GMP Today: `https://gmptoday.in/api/gmp.json` — public machine-readable GMP dataset.
- GitHub mirror: `https://raw.githubusercontent.com/Spectrumz00/india-ipo-gmp-data/main/data/gmp-latest.json` — open mirror of the GMP Today dataset.
- NSE public IPO endpoints are attempted when reachable. They are treated as an optional enrichment source, not a hard dependency, because exchange web endpoints may reject automated requests.

## Market
- NSE/BSE public feeds are attempted for Indian indices.
- Yahoo public chart feed and TradingView public scanner are used for free global/commodity/GIFT-Nifty coverage. These are public/undocumented feeds and can be delayed or unavailable.
- No snapshot fallback is bundled into the project.

## Metals
- Gold-API public XAU/XAG spot feed, no key.
- USD/INR is taken from the dashboard FX source for INR conversion.

## News
- Google News RSS.

## Commercial-use note
Free/public feeds can have their own rate limits, delay, redistribution and licensing conditions. BazaarBrief should verify the terms of each provider before commercial redistribution of their data.
