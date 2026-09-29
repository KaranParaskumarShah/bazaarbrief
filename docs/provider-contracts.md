# BazaarBrief provider contracts

## 1. NSE India

Primary source for Indian exchange data where the public web endpoint is available:

- NIFTY 50
- BANK NIFTY
- NIFTY 50 constituent stock quotes
- FII/DII public data
- IPO fallback

NSE's public market-live page states that its market view can run about 1–3 minutes behind real-time trading. NSE endpoints may also reject automated traffic; the refresh script retries and falls back where appropriate.

## 2. BSE India

Primary source for SENSEX through BSE's public real-time endpoint.

## 3. IPO Guru

Primary IPO enrichment source when `IPOGURU_API_KEY` is configured.

One `/api/v1/ipos` request is made per scheduled refresh. The response is split into Mainboard and SME and normalized into the site's common IPO schema.

The API supplies issue dates, price band, lot size, issue size, subscription and unofficial GMP fields. GMP and subscription carry their own update timestamps when supplied by the provider.

## 4. Yahoo Finance public chart feed

Used for:

- S&P 500
- NASDAQ 100
- FTSE 100
- HANG SENG
- USD/INR
- Brent
- WTI
- Natural Gas

Yahoo's chart response supplies a provider market timestamp and intraday close series. The site uses that timestamp rather than pretending the GitHub fetch time is the quote time.

The feed is public/undocumented and can be delayed or unavailable. It is a fallback-oriented free source and should not be treated as a licensed exchange redistribution feed.

## 5. XAUS

Used for gold and silver spot-equivalent values in INR. A stale response is rejected; BazaarBrief does not publish a stale metal price as a fresh value.

The displayed gold unit is ₹/10g and silver is ₹/kg.

## 6. TradingView scanner

Used primarily for the GIFT Nifty indicator and as a fallback for global/commodity quotes when Yahoo does not return a usable value.

GIFT Nifty is a futures indicator, not NIFTY 50 spot. TradingView's website data can be delayed depending on the market/data entitlement.

## 7. Google News RSS

Used for current market/news headlines. News is informational and is not treated as a price source.

## Failure behavior

The refresh job uses `Promise.allSettled` for independent providers. A provider failure is recorded in `refresh.errors`. A successful refresh replaces `latest.json` with the newly assembled dataset.

The job refuses to publish the dataset if the minimum required market coverage is not present. It does not silently create snapshot prices to satisfy the minimum.
