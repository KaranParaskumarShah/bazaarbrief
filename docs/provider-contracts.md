# Bazaar Brief free-data provider contracts

## Shared refresh model

The browser reads only `/data/latest.json`. GitHub Actions is the single scheduled caller and refreshes the dataset every two hours. There are no per-user provider calls.

## Providers

| Dataset | Provider | Auth | Freshness / caveat |
|---|---|---|---|
| NIFTY 50 / SENSEX / BANK NIFTY | Yahoo Finance public chart feed | None | Public/undocumented feed; may be delayed or unavailable |
| GIFT NIFTY | Yahoo Finance public chart feed, configurable symbol | None | Futures quote; symbol availability can change |
| Global indices | Yahoo Finance public chart feed | None | Public/undocumented feed; may be delayed |
| Gold / Silver | Gold-API | None | Live USD/troy-oz spot with timestamp; converted to INR using live USD/INR quote |
| USD/INR | Yahoo Finance + Frankfurter fallback | None | Yahoo quote preferred; ECB reference rate as fallback |
| Brent / WTI / Natural Gas | Yahoo Finance futures symbols | None | Public feed; may be delayed |
| India index fallback | Snapdata | None | Daily snapshot only; used only when Yahoo misses an index, never bundled in the app |
| FII/DII | NSE public endpoint | None | Exchange endpoint; may reject automated requests depending on edge protection |
| IPO base data | IndianAPI `/ipo` | None | Dynamic IPO lifecycle feed; field coverage can vary |
| GMP / subscription | IPO Guru | Free API key | Free developer API; GMP is unofficial/market-reported |
| News | Google News RSS | None | RSS aggregation; headline timestamps preserved |

## No snapshot policy

`public/data/latest.json` starts empty. The refresh script never writes a fabricated financial number. If a provider fails, that field is omitted and the refresh result records the error.

## Commercial-use warning

Free public feeds can have licensing, attribution, rate-limit, delay, and redistribution restrictions. Bazaar Brief should verify each provider's current terms before commercial redistribution. Free does not mean exchange-licensed real-time market data.
