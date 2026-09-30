# BazaarBrief architecture

## Runtime model

The browser reads one static JSON file:

`/data/latest.json`

The browser never calls NSE, BSE, TradingView or commodity providers directly.

## Scheduled refresh

GitHub Actions runs the same collector on two schedules:

- **Market:** every hour from 10:00 through 17:00 IST, Monday-Friday.
- **IPO + FII/DII:** every 2 hours at :15, 10:15-18:15 IST, every day.

The second schedule also runs after the cash market close so official NSE/BSE EOD closes and the evening FII/DII report can be captured.

## Indian market data

1. NSE public market feed → NIFTY 50, BANK NIFTY and NIFTY 50 stocks.
2. BSE public market feed → SENSEX.
3. After the cash-market close, NSE/BSE historical EOD feeds are attempted and marked `FINAL CLOSE` only when an official EOD record is returned.
4. TradingView is only a free fallback for the index cards when the public exchange endpoint is temporarily unavailable.

## FII/DII

The collector first tries NSE's public `fiidiiTradeReact` endpoint. If that endpoint is unavailable or returns an unexpected shape, it parses the public NSE FII/FPI & DII report page. The stored record includes FII/FPI buy, sell and net values, DII buy, sell and net values, date, source and provisional status.

## IPO architecture

The IPO pipeline is now **NSE-first and GMP-independent**.

1. Fetch NSE current/forthcoming IPO issue list.
2. Deduplicate by NSE symbol.
3. For each IPO, fetch NSE Issue Information using the correct board series:
   - `EQ` for Mainboard.
   - `SME` for SME.
4. Try the public NSE JSON route first; fall back to the public Issue Information page when necessary.
5. Store a normalized summary plus a complete `details` map of the fields exposed by NSE.
6. Store document links when NSE exposes them.
7. GMP is intentionally deferred and cannot block IPO publishing.

This gives BazaarBrief a much richer official IPO record: issue type, price range, lot, issue size, discount, face value, tick size, retail/QIB/NII limits, market timings, lead managers, sponsor banks, categories, UPI rules, registrar, registrar contact/address, ASBA link, RHP and other issue documents, plus the full NSE field set returned for that issue.

## No snapshot fallback

`public/data/latest.json` starts empty. A refresh only writes a new dataset after the collector obtains usable API data. The application does not bundle hard-coded market values.
