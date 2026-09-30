# Provider contracts

BazaarBrief uses a shared scheduled dataset. The browser does not call financial providers directly.

## NSE India — market + IPO primary source

- NSE public market/index endpoints for NIFTY 50, BANK NIFTY and NIFTY 50 constituents.
- NSE public FII/FPI + DII report/API for institutional flow.
- NSE public IPO issue list for current/forthcoming issues.
- NSE public Issue Information per IPO for the detailed issue record.
- NSE public offer-document links when exposed by Issue Information.

The IPO collector fetches the issue list first, then requests each IPO's NSE Issue Information using its symbol and board series (`EQ` or `SME`). It preserves a complete `details` object so new NSE fields can be displayed without changing the core schema.

## BSE India

- Public BSE index feed for SENSEX.
- Public historical index feed for final SENSEX close.

## TradingView public scanner

Used only as a free public fallback/indicator for GIFT Nifty and selected energy/index quotes. It is not an exchange-licensed real-time feed.

## OroPocket public India metals feed

Used for India gold/silver buy quotes in INR per gram. The dashboard does not manufacture an Indian metal rate by multiplying a USD spot quote by FX.

## GMP

GMP is intentionally **not part of the current IPO refresh dependency**. A separate GMP provider will be integrated later.

## Commercial / redistribution note

These public endpoints can change, throttle, block automated traffic, or impose their own usage/redistribution conditions. BazaarBrief should treat the dataset as delayed/indicative unless the underlying provider explicitly supplies a real-time or redistribution-compatible feed.
