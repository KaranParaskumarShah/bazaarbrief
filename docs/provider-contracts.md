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

Used for global indices and USD/INR. This is a public/undocumented feed and may be delayed or unavailable.

### OroPocket

`https://api.oropocket.com/public/prices`

No API key is required. The public endpoint returns gold and silver buy/sell quotes in INR per gram, GST component and 24-hour change. BazaarBrief displays the buy rate and labels it as an India buy quote rather than a spot/MCX/LBMA benchmark. The collector calls it once per shared refresh, not once per visitor.

### TradingView public scanner

Used for GIFT Nifty and as a fallback for NIFTY 50, BANK NIFTY and SENSEX when the primary NSE/BSE public exchange endpoints do not return a usable quote. Brent, WTI and Natural Gas also use the scanner. These values are labelled as public-scanner/provider quotes and are not claimed to be licensed exchange-grade real-time redistribution.

### Google News RSS

Used only for headlines and source links.

## Commercial / redistribution note

Free public feeds can have their own rate limits, delays, terms and redistribution conditions. Verify the provider terms before commercial redistribution. BazaarBrief should show source/timestamp context rather than implying exchange-grade tick-by-tick licensing where none exists.
