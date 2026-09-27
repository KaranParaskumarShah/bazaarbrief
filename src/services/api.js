import { API_KEYS } from '../config';
import { initialMarketData } from '../data/initialMarketData';

const TD = 'https://api.twelvedata.com';
const FIN_IPO = 'https://finapi.upvaly.com/api/ipo';
const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const FX = 'https://api.frankfurter.app/latest?from=USD&to=INR';

async function json(url, options = {}) {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Invalid response (${res.status})`); }
  if (!res.ok) throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  return data;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function twelveQuotes(symbols) {
  if (!API_KEYS.TWELVE_DATA) {
    return { configured: false, rows: [], provider: 'Twelve Data', reason: 'VITE_TWELVE_DATA_KEY is not configured' };
  }

  const url = `${TD}/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${encodeURIComponent(API_KEYS.TWELVE_DATA)}`;
  const data = await json(url);
  const rows = symbols.map((symbol) => {
    const r = data?.[symbol] || (symbols.length === 1 ? data : null) || {};
    return {
      symbol,
      name: r.name || symbol,
      price: num(r.close ?? r.price),
      change: num(r.change),
      changePercent: num(r.percent_change),
      currency: r.currency || 'INR',
      asOf: r.datetime || r.timestamp || null,
      error: r.status === 'error' ? r.message : null,
    };
  }).filter(r => r.price != null || !r.error);

  return { configured: true, provider: 'Twelve Data', rows };
}

async function fxRate() {
  const data = await json(FX);
  return { symbol: 'USD/INR', price: num(data?.rates?.INR), currency: 'INR', asOf: data?.date || null, provider: 'Frankfurter' };
}

async function ipoFeed() {
  const data = await json(FIN_IPO);
  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return { configured: true, provider: 'FinAPI', rows };
}

async function newsFeed() {
  // GDELT is a public, no-key global news index. It is used instead of a
  // hard-coded news JSON file so headlines cannot silently become stale.
  const query = encodeURIComponent('(India stock market OR NSE OR BSE OR IPO) sourcelang:english');
  const data = await json(`${GDELT}?query=${query}&mode=artlist&maxrecords=12&format=json&sort=datedesc`);
  const rows = (data?.articles || []).map(a => ({
    title: a.title,
    url: a.url,
    site: a.domain || a.sourcecountry || 'News',
    publishedDate: a.seendate || '',
  }));
  return { configured: true, provider: 'GDELT', rows };
}

function commodity(quotes, symbol, label) {
  const row = quotes?.rows?.find(r => r.symbol === symbol);
  return { symbol: label, price: row?.price ?? null, change: row?.change, changePercent: row?.changePercent, currency: row?.currency || 'USD', asOf: row?.asOf || null, provider: quotes?.provider || 'Twelve Data' };
}

function mergeRows(seedRows = [], liveRows = []) {
  const map = new Map(seedRows.map(r => [r.symbol, r]));
  liveRows.forEach(r => { if (r?.price != null || r?.changePercent != null) map.set(r.symbol, { ...map.get(r.symbol), ...r, dataStatus: 'live' }); });
  return [...map.values()];
}

export async function fetchMarketData() {
  const symbols = [
    'NIFTY:NSE', 'SENSEX:BSE', 'NIFTY BANK:NSE',
    'IXIC', 'SPX', 'DJI',
    'RELIANCE:NSE', 'HDFCBANK:NSE', 'TCS:NSE', 'INFY:NSE',
    'ICICIBANK:NSE', 'SBIN:NSE', 'BHARTIARTL:NSE', 'ITC:NSE', 'LT:NSE',
    'HAL:NSE', 'BEL:NSE', 'BDL:NSE', 'MAZDOCK:NSE', 'SOLARINDS:NSE',
    'TATAELXSI:NSE', 'DIXON:NSE', 'PERSISTENT:NSE', 'KPITTECH:NSE',
    'XAU/USD', 'XAG/USD', 'WTI/USD', 'BRENT/USD', 'HG1',
  ];

  const [quotes, fx, ipo, news] = await Promise.allSettled([
    twelveQuotes(symbols),
    fxRate(),
    ipoFeed(),
    newsFeed(),
  ]);

  const result = {
    ...initialMarketData,
    ok: true,
    updatedAt: new Date().toISOString(),
    dataStatus: 'live',
    snapshotLabel: 'Live provider response',
    refreshIntervalMs: 2 * 60 * 60 * 1000,
    market: {
      fx: fx.status === 'fulfilled' ? fx.value : initialMarketData.market.fx,
      quotes: quotes.status === 'fulfilled' ? { ...quotes.value, rows: mergeRows(initialMarketData.market.quotes.rows, quotes.value.rows) } : initialMarketData.market.quotes,
      // Commodity symbols can be added to the same Twelve Data subscription.
      // Keep them null until a provider returns a valid quote rather than showing old values.
      gold: commodity(quotes, 'XAU/USD', 'Gold').price != null ? commodity(quotes, 'XAU/USD', 'Gold') : initialMarketData.market.gold,
      silver: commodity(quotes, 'XAG/USD', 'Silver').price != null ? commodity(quotes, 'XAG/USD', 'Silver') : initialMarketData.market.silver,
      brent: commodity(quotes, 'BRENT/USD', 'Brent Crude').price != null ? commodity(quotes, 'BRENT/USD', 'Brent Crude') : initialMarketData.market.brent,
      wti: commodity(quotes, 'WTI/USD', 'WTI Crude').price != null ? commodity(quotes, 'WTI/USD', 'WTI Crude') : initialMarketData.market.wti,
      copper: commodity(quotes, 'HG1', 'Copper').price != null ? commodity(quotes, 'HG1', 'Copper') : initialMarketData.market.copper,
    },
    ipo: {
      india: ipo.status === 'fulfilled' ? { ...ipo.value, rows: ipo.value.rows?.length ? ipo.value.rows : initialMarketData.ipo.rows } : initialMarketData.ipo,
      calendar: ipo.status === 'fulfilled' ? { ...ipo.value, rows: ipo.value.rows?.length ? ipo.value.rows : initialMarketData.ipo.rows } : initialMarketData.ipo,
    },
    fiiDii: {
      configured: false,
      rows: [],
      reason: 'NSE FII/DII endpoints are not reliably browser-CORS accessible. No stale hard-coded values are shown.',
    },
    news: news.status === 'fulfilled' ? { ...news.value, rows: news.value.rows?.length ? news.value.rows : initialMarketData.news.rows } : initialMarketData.news,
    sourceNotes: {
      market: 'Twelve Data (browser API key required)',
      fx: 'Frankfurter public exchange-rate API',
      ipo: 'FinAPI public IPO feed',
      news: 'GDELT public news index',
      fiiDii: 'Unavailable in pure browser mode without a CORS-safe provider',
    },
  };

  const failures = [quotes, fx, ipo, news].filter(x => x.status === 'rejected');
  if (failures.length === 4) return { ...initialMarketData, ok: true, dataStatus: 'seed', updatedAt: initialMarketData.updatedAt, error: 'Live providers unavailable; showing the latest dated snapshot.' };
  return result;
}
