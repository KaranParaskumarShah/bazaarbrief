# Provider contracts

## Free / no-key providers

### FinAPI IPO

`https://finapi.upvaly.com/api/ipo`

Used for basic IPO issue data. The provider currently advertises this endpoint as available in its free tier without signup/API key.

### GMP Today

`https://gmptoday.in/api/gmp.json`

Used for unofficial GMP, ranges, subscription and confidence fields where supplied.

GMP is not exchange data and must remain labelled unofficial.

### NSE / BSE public feeds

Used for Indian indices, NIFTY 50 constituent quotes, and final EOD closes.

Public exchange web endpoints can reject automated/cloud requests. The collector treats optional enrichment as optional and does not manufacture data when a request is blocked.

### Yahoo public chart feed

Used for global indices, USD/INR and energy contracts. This is a public/undocumented feed and may be delayed or unavailable.

### Gold-API

`https://api.gold-api.com/price/XAU`
`https://api.gold-api.com/price/XAG`

No API key is required for the real-time price endpoints. Gold and silver are returned as USD/troy-ounce spot prices. BazaarBrief also calculates an INR equivalent using its shared USD/INR quote.

### TradingView public scanner

Used for GIFT Nifty. The quote is explicitly treated as a futures/pre-market indicator and not as NIFTY 50 spot.

### Google News RSS

Used only for headlines and source links.

## Commercial / redistribution note

Free public feeds can have their own rate limits, delays, terms and redistribution conditions. Verify the provider terms before commercial redistribution. BazaarBrief should show source/timestamp context rather than implying exchange-grade tick-by-tick licensing where none exists.
