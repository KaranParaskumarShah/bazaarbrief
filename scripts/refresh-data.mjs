import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * BazaarBrief data collector — CLEAN FREE/NO-KEY ARCHITECTURE
 *
 * Provider policy:
 * - Indian indices/stocks: NSE public feed; SENSEX: BSE public feed.
 * - Final Indian cash-market close: NSE/BSE historical EOD feeds.
 * - GIFT Nifty: TradingView public scanner, NSE International Exchange symbol.
 * - Global indices/FX: Yahoo public chart feed; energy: TradingView public scanner.
 * - Gold/Silver: OroPocket public India buy/sell rate feed, INR per gram, no API key.
 * - IPO details: NSE public IPO issue list + per-issue NSE Issue Information.
 * - IPO documents: NSE public offer-document links when exposed by the issue information feed.
 * - GMP/subscription: intentionally deferred; IPO data must not depend on GMP providers.
 * - News: Google News RSS.
 *
 * Only the providers listed above are used by this collector.
 */

const OUT = path.resolve('public/data/latest.json');
const NOW = new Date().toISOString();
const TIMEOUT = 15000;
const NSE_BASE = 'https://www.nseindia.com';
const NSE_IPO_PAGE = `${NSE_BASE}/market-data/all-upcoming-issues-ipo`;
const NEWS_URL = 'https://news.google.com/rss/search?q=Indian%20stock%20market%20Nifty%20Sensex%20IPO&hl=en-IN&gl=IN&ceid=IN:en';
const TROY_OZ_GRAMS = 31.1034768;

const num = value => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, '').replace(/₹|\$/g, '').trim();
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const text = value => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
};

const first = (...values) => values.find(v => v !== null && v !== undefined && String(v).trim() !== '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const changePts = (value, previous) => value != null && previous != null ? value - previous : null;
const changePct = (value, previous) => value != null && previous ? ((value - previous) / previous) * 100 : null;
const slugify = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const ipoKey = value => String(value || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\b(private|pvt|limited|ltd|india|inc|ipo|company|co)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'BazaarBrief/5.0 (+https://bazaarbrief.in)',
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/rss+xml,application/xml,text/xml,text/plain,*/*',
      'User-Agent': 'BazaarBrief/5.0 (+https://bazaarbrief.in)',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(options.timeout ?? TIMEOUT)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function retryJson(url, options = {}, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(800 * (i + 1));
    }
  }
  throw lastError;
}

function indiaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    year, month, day, hour, minute,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    // Give the EOD provider enough time to publish the final official close.
    afterCashClose: hour > 15 || (hour === 15 && minute >= 45)
  };
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function ddmmyyyy(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function toISODate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'Data', 'table', 'Table', 'records', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

// ---------------- NSE / BSE ----------------

function nseHeaders(cookie = '') {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en;q=0.9',
    Referer: NSE_IPO_PAGE,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function createNseSession() {
  const urls = [NSE_BASE, NSE_IPO_PAGE];
  const cookieMap = new Map();
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: nseHeaders(),
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!response.ok) continue;
      const cookies = response.headers.getSetCookie?.() || [];
      for (const cookie of cookies) {
        const pair = cookie.split(';')[0];
        const [name, ...rest] = pair.split('=');
        if (name) cookieMap.set(name, rest.join('='));
      }
    } catch {
      // Try the next NSE landing page; one successful page is enough.
    }
  }
  return [...cookieMap.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function nseGet(pathname, cookie, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${NSE_BASE}${pathname}`, {
        headers: {
          ...nseHeaders(cookie),
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!response.ok) throw new Error(`${pathname} -> HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(900);
    }
  }
  throw lastError;
}

function normalizeNseIndex(row, name) {
  const value = num(first(row?.last, row?.lastPrice, row?.ltp, row?.indexValue, row?.price));
  if (value == null) return null;
  const previous = num(first(row?.previousClose, row?.prevClose, row?.close));
  return {
    name,
    value,
    change: num(first(row?.change, row?.netChange)) ?? changePts(value, previous),
    pct: num(first(row?.percentChange, row?.pChange, row?.perChange)) ?? changePct(value, previous),
    kind: 'index',
    asOf: first(row?.timeVal, row?.timestamp, row?.lastUpdateTime, NOW),
    source: 'NSE India public market feed',
    priceType: 'intraday_ltp',
    finalized: false,
    sessionStatus: 'intraday'
  };
}

async function fetchNseMarket() {
  const cookie = await createNseSession();
  if (!cookie) throw new Error('NSE session could not be established');

  let allIndices = null;
  let niftyPayload = null;
  const errors = [];

  try {
    allIndices = await nseGet('/api/allIndices', cookie);
  } catch (error) {
    errors.push(`allIndices: ${error.message}`);
  }

  try {
    niftyPayload = await nseGet('/api/equity-stockIndices?index=NIFTY%2050', cookie);
  } catch (error) {
    errors.push(`equity-stockIndices: ${error.message}`);
  }

  const rows = unwrapRows(allIndices);
  const find = pattern => rows.find(row => pattern.test(String(row?.indexName || row?.name || '')));
  const nifty = normalizeNseIndex(find(/^NIFTY 50$/i), 'NIFTY 50');
  const bank = normalizeNseIndex(find(/NIFTY BANK/i), 'BANK NIFTY');

  const stocks = unwrapRows(niftyPayload)
    .filter(row => row?.symbol && row?.lastPrice != null)
    .map(row => ({
      symbol: String(row.symbol),
      name: row.meta?.companyName || row.companyName || row.symbol,
      price: num(row.lastPrice),
      pct: num(first(row.pChange, row.percentChange)),
      change: num(row.change),
      source: 'NSE India public market feed',
      asOf: first(row.lastUpdateTime, NOW)
    }))
    .filter(row => row.price != null);

  if (!nifty && !bank && !stocks.length) {
    throw new Error(`NSE returned no usable market records${errors.length ? ` (${errors.join('; ')})` : ''}`);
  }

  return { cookie, indices: [nifty, bank].filter(Boolean), stocks, errors };
}

function normalizeNseEod(row, name) {
  const value = num(first(row?.EOD_CLOSE_INDEX_VAL, row?.CLOSE_INDEX_VAL, row?.close, row?.Close));
  if (value == null) return null;
  const closeDate = toISODate(first(row?.EOD_TIMESTAMP, row?.TIMESTAMP, row?.date, row?.Date));
  const previous = num(first(row?.PREV_CLOSE, row?.PREV_CLOSE_INDEX_VAL, row?.prevClose));
  return {
    name,
    value,
    change: changePts(value, previous),
    pct: changePct(value, previous),
    closeDate,
    priceType: 'official_eod_close',
    finalized: true,
    source: 'NSE historical index close',
    asOf: closeDate ? `${closeDate}T15:30:00+05:30` : NOW,
    sessionStatus: 'closed'
  };
}

async function fetchNseEod(cookie) {
  if (!cookie) throw new Error('NSE session unavailable');
  const start = dateDaysAgo(7);
  const end = indiaNow().date;
  const output = {};
  for (const [indexType, name] of [['NIFTY%2050', 'NIFTY 50'], ['NIFTY%20BANK', 'BANK NIFTY']]) {
    const payload = await nseGet(`/api/historical/indicesHistory?indexType=${indexType}&from=${ddmmyyyy(start)}&to=${ddmmyyyy(end)}`, cookie);
    const rows = payload?.data?.indexCloseOnlineRecords || payload?.indexCloseOnlineRecords || unwrapRows(payload);
    const values = rows.map(row => normalizeNseEod(row, name)).filter(Boolean).sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate)));
    if (values.length) output[name] = values.at(-1);
  }
  return output;
}

async function fetchBseSensex() {
  const payload = await fetchJson('https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w', {
    headers: { Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' }
  });
  const candidates = [
    ...unwrapRows(payload),
    ...unwrapRows(payload?.data),
    ...unwrapRows(payload?.Table),
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? [payload] : [])
  ];
  const row = candidates.find(item => num(first(item?.LTP, item?.ltp, item?.Ltp, item?.Value, item?.IndexValue)) != null);
  if (!row) throw new Error('BSE SENSEX feed returned no LTP');
  const value = num(first(row?.LTP, row?.ltp, row?.Ltp, row?.Value, row?.IndexValue));
  const previous = num(first(row?.PrevClose, row?.prevClose, row?.PreviousClose));
  return {
    name: 'SENSEX', value,
    change: num(first(row?.Change, row?.change, row?.NetChange)) ?? changePts(value, previous),
    pct: num(first(row?.['Change %'], row?.ChangePercent, row?.changePercent, row?.PChange)) ?? changePct(value, previous),
    kind: 'index',
    asOf: first(row?.DateTime, row?.dateTime, row?.UpdatedOn, NOW),
    source: 'BSE India public SENSEX feed',
    priceType: 'intraday_ltp',
    finalized: false,
    sessionStatus: 'intraday'
  };
}

async function fetchBseEodSensex() {
  const start = dateDaysAgo(7);
  const end = indiaNow().date;
  const url = `https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAll/w?fmdt=${ddmmyyyy(start)}&todt=${ddmmyyyy(end)}&index=All&period=D`;
  const payload = await fetchJson(url, {
    headers: { Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' }
  });
  const rows = unwrapRows(payload).filter(row => /SENSEX/i.test(String(row?.IndexName || row?.indexName || row?.Index || row?.Name || '')));
  const normalized = rows.map(row => {
    const value = num(first(row?.Close, row?.CLOSE, row?.IndexClose, row?.CloseValue));
    if (value == null) return null;
    const previous = num(first(row?.PrevClose, row?.PREVCLOSE, row?.PreviousClose));
    const dateRaw = first(row?.Date, row?.DATE, row?.DateTime);
    return {
      name: 'SENSEX', value,
      change: num(row?.Change) ?? changePts(value, previous),
      pct: num(first(row?.['Change %'], row?.ChangePercent)) ?? changePct(value, previous),
      closeDate: toISODate(dateRaw) || String(dateRaw || '').slice(0, 10),
      priceType: 'official_eod_close', finalized: true,
      source: 'BSE historical index close',
      asOf: dateRaw || NOW,
      sessionStatus: 'closed'
    };
  }).filter(Boolean).sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate)));
  if (!normalized.length) throw new Error('BSE historical SENSEX feed returned no close');
  return normalized.at(-1);
}

async function fetchFiiDii(cookie) {
  const sessionCookie = cookie || await createNseSession();
  if (!sessionCookie) throw new Error('NSE session unavailable for FII/DII');

  const readRows = payload => unwrapRows(payload).flatMap(row => {
    if (Array.isArray(row)) return row;
    return [row];
  });

  const normalize = rows => {
    const result = { fii: null, dii: null, fiiBuy: null, fiiSell: null, diiBuy: null, diiSell: null, date: null };
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const category = String(first(row?.category, row?.Category, row?.clientType, row?.type, row?.participant, row?.PARTICIPANT_TYPE) || '').toUpperCase();
      const buy = num(first(row?.buyValue, row?.BuyValue, row?.buy, row?.BUY_VALUE, row?.buyValueCr));
      const sell = num(first(row?.sellValue, row?.SellValue, row?.sell, row?.SELL_VALUE, row?.sellValueCr));
      const net = num(first(row?.netValue, row?.NetValue, row?.net, row?.NET_VALUE, row?.netValueInCr, row?.netValueCr));
      const date = toISODate(first(row?.date, row?.Date, row?.tradeDate, row?.TRADE_DATE));
      if (date && !result.date) result.date = date;
      if (/FII|FPI/.test(category)) {
        result.fii = net ?? (buy != null && sell != null ? buy - sell : null);
        result.fiiBuy = buy;
        result.fiiSell = sell;
      } else if (/DII/.test(category)) {
        result.dii = net ?? (buy != null && sell != null ? buy - sell : null);
        result.diiBuy = buy;
        result.diiSell = sell;
      }
    }
    // NSE has also returned a compact grouped shape in some revisions:
    // { fiinet, fiibuy, fiisell, diinet, diibuy, diisell, date }.
    if (list.length === 1) {
      const row = list[0] || {};
      result.fii = result.fii ?? num(first(row.fiinet, row.FIINet, row.fiiNet));
      result.dii = result.dii ?? num(first(row.diinet, row.DIINet, row.diiNet));
      result.fiiBuy = result.fiiBuy ?? num(first(row.fiibuy, row.FIIBuy, row.fiiBuy));
      result.fiiSell = result.fiiSell ?? num(first(row.fiisell, row.FIISell, row.fiiSell));
      result.diiBuy = result.diiBuy ?? num(first(row.diibuy, row.DIIBuy, row.diiBuy));
      result.diiSell = result.diiSell ?? num(first(row.diisell, row.DIISell, row.diiSell));
      result.date = result.date || toISODate(first(row.date, row.Date));
    }
    return result;
  };

  // NSE's current public JSON endpoint is the primary source.
  try {
    const payload = await nseGet('/api/fiidiiTradeReact', sessionCookie, 3);
    const result = normalize(readRows(payload));
    if (result.fii != null || result.dii != null) {
      return {
        ...result,
        date: result.date || indiaNow().date,
        source: 'NSE India public FII/FPI & DII endpoint',
        asOf: NOW,
        provisional: true
      };
    }
  } catch (error) {
    // Continue to the public report-page parser below.
  }

  // NSE also exposes the same activity on its public FII/DII report page.
  // This fallback is useful when the JSON endpoint is temporarily unavailable.
  const html = await fetchText(`${NSE_BASE}/reports/fii-dii`, { headers: nseHeaders(sessionCookie) });
  const rows = [];
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const match of trMatches) {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => text(m[1]));
    if (cells.length >= 5) {
      rows.push({ category: cells[0], date: cells[1], buyValue: cells[2], sellValue: cells[3], netValue: cells[4] });
    }
  }
  const result = normalize(rows);
  if (result.fii == null && result.dii == null) throw new Error('NSE FII/DII report returned no recognised FII/FPI and DII rows');
  return {
    ...result,
    date: result.date || indiaNow().date,
    source: 'NSE India FII/FPI & DII public report',
    asOf: NOW,
    provisional: true
  };
}

// ---------------- Yahoo / TradingView / metals ----------------

function yahooQuoteResult(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo returned no chart result for ${symbol}`);
  const meta = result.meta || {};
  const value = num(first(meta.regularMarketPrice, meta.previousClose));
  if (value == null) throw new Error(`Yahoo returned no price for ${symbol}`);
  const previous = num(meta.previousClose);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps.map((timestamp, i) => ({
    t: new Date(timestamp * 1000).toISOString(),
    v: num(closes[i])
  })).filter(item => item.v != null).slice(-60);
  const providerTime = meta.regularMarketTime || timestamps.at(-1);
  return {
    value,
    change: changePts(value, previous),
    pct: changePct(value, previous),
    asOf: providerTime ? new Date(providerTime * 1000).toISOString() : NOW,
    currency: meta.currency || null,
    series,
    providerSymbol: symbol,
    source: 'Yahoo Finance public chart feed'
  };
}

async function yahooQuote(name, symbol, kind) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=true`;
  return { name, kind, ...yahooQuoteResult(await fetchJson(url), symbol) };
}

async function fetchYahooSet(definitions) {
  const settled = await Promise.allSettled(definitions.map(def => yahooQuote(def.name, def.symbol, def.kind)));
  const good = [];
  const errors = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') good.push(result.value);
    else errors.push(`${definitions[i].name}: ${result.reason?.message || result.reason}`);
  });
  return { good, errors };
}

async function tradingViewScan(tickers) {
  const response = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      Origin: 'https://www.tradingview.com',
      Referer: 'https://www.tradingview.com/'
    },
    body: JSON.stringify({
      symbols: { tickers },
      columns: ['close', 'change', 'change_abs', 'currency', 'description']
    }),
    signal: AbortSignal.timeout(TIMEOUT)
  });
  if (!response.ok) throw new Error(`TradingView scanner HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchTradingViewSet(definitions) {
  const tickers = definitions.map(def => def.ticker);
  const rows = await tradingViewScan(tickers);
  const byTicker = new Map(rows.map(row => [String(row?.s || '').toUpperCase(), row]));
  const good = [];
  const errors = [];

  for (const def of definitions) {
    const row = byTicker.get(def.ticker.toUpperCase());
    const values = row?.d;
    const value = num(values?.[0]);
    if (value == null) {
      errors.push(`${def.name}: TradingView scanner returned no current quote`);
      continue;
    }
    good.push({
      name: def.name,
      value,
      pct: num(values?.[1]),
      change: num(values?.[2]),
      currency: text(values?.[3]) || 'USD',
      kind: def.kind || 'market',
      asOf: NOW,
      providerSymbol: def.ticker,
      source: 'TradingView public scanner',
      priceType: def.priceType || 'market_quote',
      finalized: false,
      sessionStatus: 'provider'
    });
  }
  return { good, errors };
}

async function fetchGiftNifty() {
  const ticker = `NSEIX:${process.env.GIFT_NIFTY_SYMBOL || 'NIFTY1!'}`;
  const rows = await tradingViewScan([ticker]);
  const row = rows.find(item => String(item?.s || '').toUpperCase() === ticker.toUpperCase()) || rows[0];
  if (!row?.d?.length) throw new Error('GIFT Nifty quote unavailable');
  const [value, pctValue, changeValue, currency] = row.d;
  const valueNum = num(value);
  if (valueNum == null) throw new Error('GIFT Nifty returned no price');
  return {
    name: 'GIFT NIFTY', value: valueNum, pct: num(pctValue), change: num(changeValue),
    currency: currency || null, kind: 'futures', asOf: NOW,
    source: 'TradingView public scanner · NSE International Exchange',
    priceType: 'futures_indicator', finalized: false,
    note: 'GIFT Nifty futures indicator; provider timestamp is not exposed by this public scanner.'
  };
}

async function fetchMetals() {
  const payload = await retryJson('https://api.oropocket.com/public/prices', {}, 2);
  const data = payload?.data;
  const gold = data?.gold;
  const silver = data?.silver;
  if (!gold || !silver) throw new Error('OroPocket returned no gold/silver India rates');
  const goldBuy = num(gold.buy);
  const silverBuy = num(silver.buy);
  if (goldBuy == null || silverBuy == null) throw new Error('OroPocket returned invalid gold/silver buy rates');
  return {
    gold: {
      buyPerGram: goldBuy,
      sellPerGram: num(gold.sell),
      gstPerGram: num(gold.gst),
      changePercent: num(gold.change24h?.buy),
      asOf: first(data.timestamp, NOW),
      source: 'OroPocket India gold buy rate',
      unit: 'INR per gram'
    },
    silver: {
      buyPerGram: silverBuy,
      sellPerGram: num(silver.sell),
      gstPerGram: num(silver.gst),
      changePercent: num(silver.change24h?.buy),
      asOf: first(data.timestamp, NOW),
      source: 'OroPocket India silver buy rate',
      unit: 'INR per gram'
    }
  };
}

function metalInr(usdPerOz, usdInr, unit) {
  if (usdPerOz == null || usdInr == null) return null;
  if (unit === '10g') return usdPerOz * usdInr * 10 / TROY_OZ_GRAMS;
  if (unit === 'kg') return usdPerOz * usdInr * 1000 / TROY_OZ_GRAMS;
  return null;
}

// ---------------- IPO ----------------

function parseBand(value) {
  const values = [...String(value ?? '').matchAll(/\d[\d,.]*/g)]
    .map(match => num(match[0]))
    .filter(v => v != null);
  if (!values.length) return { min: null, max: null };
  const min = values[0];
  const max = values[1] ?? values[0];
  return { min, max };
}

function explicitBoard(raw) {
  const source = String(first(raw.type, raw.issueType, raw.issue_type, raw.board, raw.segment, raw.category, raw.exchange, raw.sub_type, raw.securityType) || '').toLowerCase();
  return source.includes('sme') || raw.isSme === true || raw.is_sme === true || String(raw.series || '').toUpperCase() === 'SME' ? 'SME' : 'Mainboard';
}

function ipoStatus(openDate, closeDate, status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('open') || normalized.includes('active') || normalized.includes('live')) return 'Open';
  if (normalized.includes('forthcoming') || normalized.includes('upcoming')) return 'Upcoming';
  if (normalized.includes('closed')) return 'Closed';
  if (normalized.includes('listed')) return 'Listed';
  const today = indiaNow().date;
  if (openDate && openDate <= today && (!closeDate || closeDate >= today)) return 'Open';
  if (closeDate && closeDate < today) return 'Closed';
  return 'Upcoming';
}

function extractRows(payload, depth = 0, rows = []) {
  if (payload == null || depth > 7) return rows;
  if (Array.isArray(payload)) {
    payload.forEach(item => extractRows(item, depth + 1, rows));
    return rows;
  }
  if (typeof payload !== 'object') return rows;
  const looksLikeIpo = ['name', 'company', 'companyName', 'ipoName', 'title', 'symbol', 'Symbol', 'Company Name'].some(key => payload[key] != null);
  if (looksLikeIpo) rows.push(payload);
  Object.entries(payload).forEach(([key, value]) => {
    if (['meta', 'config', 'disclaimer', 'pagination'].includes(key)) return;
    if (Array.isArray(value) || (value && typeof value === 'object')) extractRows(value, depth + 1, rows);
  });
  return rows;
}

function flattenNseDetails(payload, out = {}, path = '', depth = 0) {
  if (payload == null || depth > 8) return out;
  if (Array.isArray(payload)) {
    payload.forEach((value, index) => flattenNseDetails(value, out, path ? `${path}.${index}` : String(index), depth + 1));
    return out;
  }
  if (typeof payload !== 'object') {
    if (path) out[path] = text(payload);
    return out;
  }

  const label = first(payload.label, payload.Label, payload.name, payload.Name, payload.key, payload.Key, payload.field, payload.Field, payload.title, payload.Title);
  const value = first(payload.value, payload.Value, payload.displayValue, payload.DisplayValue, payload.data, payload.Data, payload.text, payload.Text);
  if (label && value != null && typeof value !== 'object') out[text(label)] = text(value);

  for (const [key, child] of Object.entries(payload)) {
    const next = path ? `${path}.${key}` : key;
    if (child && typeof child === 'object') flattenNseDetails(child, out, next, depth + 1);
    else if (child != null && child !== '') out[key] = text(child);
  }
  return out;
}

function detailValue(details, aliases) {
  const entries = Object.entries(details || {});
  const wanted = aliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of entries) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.some(alias => normalized === alias || normalized.includes(alias))) return value;
  }
  return null;
}

function normalizeNseIssue(raw, details, source = 'NSE official IPO Issue Information') {
  const merged = { ...(raw || {}) };
  const aliases = {
    symbol: ['symbol', 'nse symbol'],
    name: ['company name', 'companyname', 'issuer name', 'name'],
    issuePeriod: ['issue period', 'issueperiod'],
    issueSize: ['issue size', 'issuesize'],
    issueType: ['issue type', 'issuetype'],
    priceRange: ['price range', 'pricerange', 'price band', 'priceband'],
    discount: ['discount'],
    faceValue: ['face value', 'facevalue'],
    tickSize: ['tick size', 'ticksize'],
    lotSize: ['bid lot', 'lot size', 'lotsize', 'market lot'],
    minimumOrderQuantity: ['minimum order quantity', 'minimumorderquantity'],
    retailMax: ['maximum subscription amount for retail investor', 'maximumsubscriptionamountforretailinvestor'],
    qibMax: ['maximum bid quantity for qib investors', 'maximumbidquantityforqibinvestors'],
    niiMax: ['maximum bid quantity for nib investors', 'maximumbidquantityfornibinvestors'],
    timings: ['ipo market timings', 'ipomarkettimings'],
    leadManagers: ['book running lead managers', 'bookrunningleadmanagers'],
    sponsorBank: ['sponsor bank', 'sponsorbank'],
    categories: ['categories'],
    upiCategories: ['sub-categories applicable for upi', 'subcategoriesapplicableforupi'],
    registrar: ['name of the registrar', 'nameoftheregistrar'],
    registrarAddress: ['address of the registrar', 'addressoftheregistrar'],
    registrarContact: ['contact person name number and email id', 'contactpersonnamenumberandemailid'],
    eform: ['e-form link', 'eformlink'],
    rhp: ['red herring prospectus', 'redherringprospectus'],
    basis: ['ratios / basis of issue price', 'ratios/basisofissueprice'],
    biddingCenters: ['bidding centers', 'biddingcenters'],
    sampleForms: ['sample application forms', 'sampleapplicationforms'],
    securityParameters: ['security parameters (pre anchor)', 'securityparameterspreanchor'],
    remark: ['remark']
  };
  for (const [field, list] of Object.entries(aliases)) {
    const v = detailValue(details, list);
    if (v != null) merged[field] = v;
  }

  const period = String(merged.issuePeriod || '');
  const dates = [...period.matchAll(/(\d{1,2}[-\/]\w{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi)].map(m => toISODate(m[1])).filter(Boolean);
  if (dates[0]) merged.issueStartDate = dates[0];
  if (dates[1]) merged.issueEndDate = dates[1];
  merged.details = Object.fromEntries(Object.entries(details || {}).filter(([k, v]) => v != null && String(v).trim() !== ''));
  return normalizeIpo(merged, source);
}

function normalizeIpo(raw, source) {
  const name = text(first(raw.name, raw.companyName, raw.company, raw.ipoName, raw.title, raw.symbol, raw['Company Name'], raw['Name'])) || 'Unnamed IPO';
  const board = explicitBoard(raw);
  const band = parseBand(first(raw.priceRange, raw.price_range, raw.priceBand, raw.price_band, raw.issuePrice, raw.issue_price, raw.price, `${first(raw.minimum_price, raw.minPrice, '')}-${first(raw.maximum_price, raw.maxPrice, '')}`));
  const lot = num(first(raw.lotSize, raw.lot_size, raw.marketLot, raw.market_lot, raw.minBidQuantity, raw.min_bid_quantity, raw.lot, raw['Bid Lot'], raw['Lot Size']));
  const issuePeriod = text(first(raw.issuePeriod, raw.issue_period));
  const periodDates = issuePeriod ? [...issuePeriod.matchAll(/(\d{1,2}[-\/]\w{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi)].map(m => toISODate(m[1])).filter(Boolean) : [];
  const openDate = toISODate(first(raw.biddingStartDate, raw.bidding_start_date, raw.issueStartDate, raw.openDate, raw.open_date, raw.startDate)) || periodDates[0] || null;
  const closeDate = toISODate(first(raw.biddingEndDate, raw.bidding_end_date, raw.issueEndDate, raw.closeDate, raw.close_date, raw.endDate)) || periodDates[1] || null;
  const issueSizeCr = num(first(raw.issueSizeCr, raw.issue_size_cr));
  const minInvestment = num(first(raw.minInvestment, raw.minimumInvestment, raw.min_investment, raw.minimum_investment)) ?? (band.max != null && lot != null ? band.max * lot : null);
  const subscription = num(first(raw.subscription, raw.subscriptionTotal, raw.subscription_total, raw.totalSubscription, raw.total_subscription, raw.overallSubscription, raw.overall_subscription, raw['No. of times issue is subscribed'], raw['No of times issue is subscribed']));
  const qib = num(first(raw.qib, raw.QIB));
  const nii = num(first(raw.nii, raw.hni, raw.NII));
  const retail = num(first(raw.retail, raw.Retail));
  const issueText = text(first(raw.issueSizeText, raw.issue_size_text, raw.issueSize, raw.issue_size, raw['Issue Size'])) || '—';
  const details = raw.details || {};

  return {
    slug: slugify(name),
    symbol: text(first(raw.symbol, raw.scrip, raw.code, raw.Symbol)),
    name,
    type: board,
    status: ipoStatus(openDate, closeDate, first(raw.status, raw.state, raw.Status)),
    exchange: text(first(raw.exchange, raw.exchangeName, raw.listingOn, raw.listing_on)) || (board === 'SME' ? 'NSE SME' : 'NSE'),
    band: band.min != null ? `₹${band.min.toLocaleString('en-IN')} – ₹${band.max.toLocaleString('en-IN')}` : '—',
    priceBand: band,
    issueType: text(first(raw.issueType, raw.IssueType, raw['Issue Type'])),
    lot: lot ?? null,
    lotSize: lot ?? null,
    min: minInvestment,
    issue: issueText,
    issueSizeCr,
    openDate,
    closeDate,
    open: openDate || '—',
    close: closeDate || '—',
    issuePeriod: issuePeriod || (openDate && closeDate ? `${openDate} → ${closeDate}` : '—'),
    allotment: toISODate(first(raw.allotmentDate, raw.allotment_date)),
    refund: toISODate(first(raw.refundDate, raw.refund_date)),
    credit: toISODate(first(raw.creditDate, raw.credit_date, raw.dematCreditDate)),
    listing: toISODate(first(raw.listingDate, raw.listing_date)),
    listingPrice: num(first(raw.listingPrice, raw.listing_price)),
    faceValue: text(first(raw.faceValue, raw.face_value, raw['Face Value'])),
    discount: text(first(raw.discount, raw.Discount)),
    tickSize: text(first(raw.tickSize, raw['Tick Size'])),
    minimumOrderQuantity: text(first(raw.minimumOrderQuantity, raw['Minimum Order Quantity'])),
    retailMax: text(raw.retailMax),
    qibMax: text(raw.qibMax),
    niiMax: text(raw.niiMax),
    marketTimings: text(raw.timings),
    registrar: text(first(raw.registrar, raw.registrarName, raw.registrar_name)),
    registrarAddress: text(raw.registrarAddress),
    registrarContact: text(raw.registrarContact),
    leadManagers: text(first(raw.leadManagers, raw.lead_managers)),
    sponsorBank: text(raw.sponsorBank),
    categories: text(raw.categories),
    upiCategories: text(raw.upiCategories),
    eform: text(raw.eform),
    rhp: text(raw.rhp),
    basis: text(raw.basis),
    biddingCenters: text(raw.biddingCenters),
    sampleForms: text(raw.sampleForms),
    securityParameters: text(raw.securityParameters),
    remark: text(raw.remark),
    fresh: text(first(raw.freshIssue, raw.fresh_issue, raw.fresh)),
    ofs: text(first(raw.ofs, raw.offerForSale, raw.offer_for_sale)),
    sector: text(first(raw.sector, raw.industry)) || '—',
    objects: text(first(raw.objects, raw.objectOfIssue, raw.object_of_issue)),
    revenue: text(raw.revenue),
    profit: text(first(raw.profit, raw.pat)),
    debt: text(first(raw.debt, raw.borrowings)),
    promoters: text(raw.promoters),
    subscription,
    qib,
    nii,
    retail,
    subscriptionUpdated: text(first(raw.subscriptionUpdated, raw.subscription_updated_at)),
    gmp: null,
    gmpPct: null,
    gmpUpdated: null,
    gmpRange: null,
    gmpConfidence: null,
    gmpSources: null,
    gmpSource: null,
    source,
    sourceDate: indiaNow().date,
    asOf: NOW,
    details
  };
}

function mergeIpos(...groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const record of group || []) {
      if (!record?.name) continue;
      const key = ipoKey(record.symbol || record.name);
      const current = byKey.get(key);
      if (!current) { byKey.set(key, record); continue; }
      const merged = { ...current };
      for (const [field, value] of Object.entries(record)) {
        const empty = value === null || value === undefined || value === '' || value === '—';
        if (!empty) merged[field] = value;
      }
      merged.details = { ...(current.details || {}), ...(record.details || {}) };
      merged.source = 'NSE official IPO issue list + NSE Issue Information';
      merged.sourceDate = indiaNow().date;
      byKey.set(key, merged);
    }
  }
  return [...byKey.values()];
}

function extractIpoRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.ipos)) return payload.ipos;
  if (Array.isArray(payload?.open)) return payload.open;
  if (Array.isArray(payload?.upcoming)) return payload.upcoming;
  return extractRows(payload);
}

function parseNseIssueInformationHtml(html) {
  const details = {};
  const links = {};
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const match of trMatches) {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => m[1]);
    if (cells.length < 2) continue;
    const label = text(cells[0]);
    const value = text(cells[1]);
    if (label && value) details[label] = value;
    const href = cells[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (label && href) links[label] = href.startsWith('http') ? href : `${NSE_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
  }
  return { ...details, ...Object.fromEntries(Object.entries(links).map(([k, v]) => [`${k} Link`, v])) };
}

async function fetchNseIssueInformation(cookie, series, symbol, statusType) {
  const apiPath = `/api/issue-information?series=${encodeURIComponent(series)}&symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(statusType)}`;
  try {
    const payload = await nseGet(apiPath, cookie, 2);
    const details = flattenNseDetails(payload);
    if (Object.keys(details).length) return { payload, details, source: 'NSE official IPO Issue Information API' };
  } catch {
    // Fall through to the public issue-information page.
  }

  const pageUrl = `${NSE_BASE}/market-data/issue-information?series=${encodeURIComponent(series)}&symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(statusType)}`;
  const html = await fetchText(pageUrl, { headers: nseHeaders(cookie) });
  const details = parseNseIssueInformationHtml(html);
  if (!Object.keys(details).length) throw new Error(`NSE issue-information returned no fields for ${symbol}`);
  return { payload: {}, details, source: 'NSE official IPO Issue Information page' };
}

async function fetchNseIpos(cookie) {
  const sessionCookie = cookie || await createNseSession();
  if (!sessionCookie) throw new Error('NSE session unavailable for IPO data');
  const [currentPayload, upcomingPayload] = await Promise.all([
    nseGet('/api/ipo-current-issue', sessionCookie, 3),
    nseGet('/api/all-upcoming-issues?category=ipo', sessionCookie, 3)
  ]);
  const listRows = [...unwrapRows(currentPayload), ...unwrapRows(upcomingPayload)];
  const base = listRows.map(row => normalizeIpo(row, 'NSE official IPO issue list')).filter(Boolean);

  const unique = new Map();
  for (const record of base) {
    const key = ipoKey(record.symbol || record.name);
    if (!unique.has(key)) unique.set(key, record);
  }

  const detailed = [];
  for (const record of unique.values()) {
    if (!record.symbol) { detailed.push(record); continue; }
    const series = record.type === 'SME' ? 'SME' : 'EQ';
    const statusType = record.status === 'Upcoming' ? 'Forthcoming' : 'Active';
    try {
      const info = await fetchNseIssueInformation(sessionCookie, series, record.symbol, statusType);
      detailed.push(normalizeNseIssue({ ...record, ...(info.payload?.data && typeof info.payload.data === 'object' ? info.payload.data : {}) }, info.details));
    } catch (error) {
      // Some already-closed/upcoming issues may not expose an issue-information payload.
      // Keep the official issue-list record instead of dropping the IPO.
      detailed.push({ ...record, detailFetchError: error.message });
    }
    await sleep(150);
  }
  return detailed;
}
async function fetchNews() {
  const xml = await fetchText(NEWS_URL);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);
  const pick = (block, tag) => {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? text(match[1].replace(/<!\[CDATA\[|\]\]>/g, '')) : '';
  };
  return items.map(match => ({
    tag: 'MARKET NEWS',
    title: pick(match[1], 'title'),
    source: 'Google News RSS',
    age: pick(match[1], 'pubDate'),
    url: pick(match[1], 'link')
  })).filter(item => item.title);
}

async function writeDataset(dataset) {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
}

function emptyDataset(errors, status = 'failed') {
  return {
    updatedAt: NOW,
    refreshWindow: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours',
    timezone: 'Asia/Kolkata',
    source: 'API-only shared feed — free public/exchange sources',
    refresh: { status, updatedAt: NOW, cadence: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours', partial: true, errors },
    dataPolicy: {
      primary: 'API-only',
      noSnapshotFallback: true,
      noPerVisitorProviderCalls: true,
      noPaidApiKeysRequired: true,
      refreshCadence: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours'
    },
    market: { indices: [], global: [], commodities: [], stocks: [] },
    fiiDii: {},
    ipo: { mainboard: [], sme: [] },
    news: []
  };
}

const errors = [];

try {
  const [nseMarket, bseSensex, yahoo, giftNifty, tv, metals, news] = await Promise.allSettled([
    fetchNseMarket(),
    fetchBseSensex(),
    fetchYahooSet([
      { name: 'S&P 500', symbol: '^GSPC', kind: 'index' },
      { name: 'NASDAQ 100', symbol: '^NDX', kind: 'index' },
      { name: 'FTSE 100', symbol: '^FTSE', kind: 'index' },
      { name: 'HANG SENG', symbol: '^HSI', kind: 'index' },
      { name: 'USD/INR', symbol: 'INR=X', kind: 'fx' }
    ]),
    fetchGiftNifty(),
    fetchTradingViewSet([
      { name: 'BRENT', ticker: 'ICEEUR:BRN1!', kind: 'commodity', priceType: 'futures_quote' },
      { name: 'WTI', ticker: 'NYMEX:CL1!', kind: 'commodity', priceType: 'futures_quote' },
      { name: 'NATURAL GAS', ticker: 'NYMEX:NG1!', kind: 'commodity', priceType: 'futures_quote' },
      { name: 'NIFTY 50 TV', ticker: 'NSE:NIFTY', kind: 'index', priceType: 'index_quote' },
      { name: 'BANK NIFTY TV', ticker: 'NSE:BANKNIFTY', kind: 'index', priceType: 'index_quote' },
      { name: 'SENSEX TV', ticker: 'BSE:SENSEX', kind: 'index', priceType: 'index_quote' }
    ]),
    fetchMetals(),
    fetchNews()
  ]);

  const nse = nseMarket.status === 'fulfilled' ? nseMarket.value : null;
  if (!nse) errors.push(`NSE market: ${nseMarket.reason?.message || nseMarket.reason}`);
  else if (nse.errors?.length) errors.push(...nse.errors.map(error => `NSE market: ${error}`));
  const sensexLive = bseSensex.status === 'fulfilled' ? bseSensex.value : null;
  if (!sensexLive) errors.push(`BSE SENSEX: ${bseSensex.reason?.message || bseSensex.reason}`);

  const yahooGood = yahoo.status === 'fulfilled' ? yahoo.value.good : [];
  if (yahoo.status === 'fulfilled') errors.push(...yahoo.value.errors.map(error => `Yahoo: ${error}`));
  else errors.push(`Yahoo: ${yahoo.reason?.message || yahoo.reason}`);
  const yahooByName = new Map(yahooGood.map(item => [item.name, item]));

  const gift = giftNifty.status === 'fulfilled' ? giftNifty.value : null;
  if (!gift) errors.push(`GIFT Nifty: ${giftNifty.reason?.message || giftNifty.reason}`);

  const tvGood = tv.status === 'fulfilled' ? tv.value.good : [];
  if (tv.status === 'fulfilled') errors.push(...tv.value.errors.map(error => `TradingView: ${error}`));
  else errors.push(`TradingView: ${tv.reason?.message || tv.reason}`);
  const tvByName = new Map(tvGood.map(item => [item.name, item]));

  const metalPayload = metals.status === 'fulfilled' ? metals.value : null;
  if (!metalPayload) errors.push(`Gold/Silver: ${metals.reason?.message || metals.reason}`);

  const session = indiaNow();
  const officialNifty = nse?.indices?.find(item => item.name === 'NIFTY 50');
  const officialBank = nse?.indices?.find(item => item.name === 'BANK NIFTY');
  const officialSensex = sensexLive;
  const tvNifty = tvByName.get('NIFTY 50 TV');
  const tvBank = tvByName.get('BANK NIFTY TV');
  const tvSensex = tvByName.get('SENSEX TV');

  let indices = [
    officialNifty || (tvNifty ? { ...tvNifty, name: 'NIFTY 50', source: 'TradingView public scanner · NSE index fallback', finalized: false } : null),
    officialBank || (tvBank ? { ...tvBank, name: 'BANK NIFTY', source: 'TradingView public scanner · NSE index fallback', finalized: false } : null),
    officialSensex || (tvSensex ? { ...tvSensex, name: 'SENSEX', source: 'TradingView public scanner · BSE index fallback', finalized: false } : null),
    gift
  ].filter(Boolean);

  if (session.afterCashClose) {
    try {
      const eodCookie = nse?.cookie || await createNseSession();
      const eod = eodCookie ? await fetchNseEod(eodCookie) : {};
      for (const [name, record] of Object.entries(eod)) {
        const exists = indices.some(item => item.name === name);
        if (exists) {
          indices = indices.map(item => item.name === name ? { ...item, ...record, note: `Final NSE close for ${record.closeDate}` } : item);
        } else {
          indices.push(record);
        }
      }
    } catch (error) {
      errors.push(`NSE EOD close: ${error.message}`);
    }
    try {
      const eodSensex = await fetchBseEodSensex();
      const exists = indices.some(item => item.name === 'SENSEX');
      if (exists) {
        indices = indices.map(item => item.name === 'SENSEX' ? { ...item, ...eodSensex, note: `Final BSE close for ${eodSensex.closeDate}` } : item);
      } else {
        indices.push(eodSensex);
      }
    } catch (error) {
      errors.push(`BSE EOD close: ${error.message}`);
    }
  }

  const global = ['S&P 500', 'NASDAQ 100', 'FTSE 100', 'HANG SENG']
    .map(name => yahooByName.get(name))
    .filter(Boolean);

  const usdInr = yahooByName.get('USD/INR');
  const commodities = [];
  if (usdInr) commodities.push({ name: 'USD/INR', ...usdInr, unit: '₹' });

  const goldBuy = num(metalPayload?.gold?.buyPerGram);
  const silverBuy = num(metalPayload?.silver?.buyPerGram);
  if (goldBuy != null) {
    commodities.push({
      name: 'GOLD',
      value: goldBuy * 10,
      inrPer10g: goldBuy * 10,
      inrPerGram: goldBuy,
      gstPerGram: metalPayload.gold.gstPerGram,
      sellPerGram: metalPayload.gold.sellPerGram,
      pct: metalPayload.gold.changePercent,
      asOf: metalPayload.gold.asOf,
      unit: '₹/10g',
      displayUnit: '₹/10g',
      source: metalPayload.gold.source,
      precious: true,
      domestic: true,
      note: '24K India buy quote · GST is not included in the displayed buy rate.'
    });
  }
  if (silverBuy != null) {
    commodities.push({
      name: 'SILVER',
      value: silverBuy * 1000,
      inrPerKg: silverBuy * 1000,
      inrPerGram: silverBuy,
      gstPerGram: metalPayload.silver.gstPerGram,
      sellPerGram: metalPayload.silver.sellPerGram,
      pct: metalPayload.silver.changePercent,
      asOf: metalPayload.silver.asOf,
      unit: '₹/kg',
      displayUnit: '₹/kg',
      source: metalPayload.silver.source,
      precious: true,
      domestic: true,
      note: 'India silver buy quote · GST is not included in the displayed buy rate.'
    });
  }


  for (const name of ['BRENT', 'WTI', 'NATURAL GAS']) {
    const quote = tvByName.get(name);
    if (quote) commodities.push({
      name,
      ...quote,
      unit: name === 'NATURAL GAS' ? '$/MMBtu' : '$/bbl',
      source: `TradingView public scanner · ${name === 'BRENT' ? 'ICE Brent futures' : name === 'WTI' ? 'NYMEX WTI futures' : 'NYMEX Henry Hub futures'}`
    });
  }

  const stocks = nse?.stocks || [];

  // FII/DII and IPO must not depend on the intraday index request succeeding.
  // NSE can block one API while still allowing another, so each domain gets its
  // own fresh NSE session when necessary.
  let fii = {};
  try {
    fii = await fetchFiiDii(nse?.cookie || null);
  } catch (error) {
    errors.push(`FII/DII: ${error.message}`);
  }

  let nseIpoRecords = [];
  try {
    nseIpoRecords = await fetchNseIpos(nse?.cookie || null);
  } catch (error) {
    errors.push(`NSE IPO data: ${error.message}`);
  }

  const mergedIpos = mergeIpos(nseIpoRecords);
  const sortIpos = list => [...list].sort((a, b) => {
    const statusWeight = item => item === 'Open' ? 0 : 1;
    const statusDiff = statusWeight(a.status) - statusWeight(b.status);
    if (statusDiff) return statusDiff;
    return String(a.closeDate || a.openDate || '9999-12-31').localeCompare(String(b.closeDate || b.openDate || '9999-12-31')) || a.name.localeCompare(b.name);
  });

  const mainboard = sortIpos(mergedIpos.filter(item => item.type === 'Mainboard' && ['Open', 'Upcoming'].includes(item.status)));
  const sme = sortIpos(mergedIpos.filter(item => item.type === 'SME' && ['Open', 'Upcoming'].includes(item.status)));
  if (!mainboard.length && !sme.length) errors.push('IPO: no open/upcoming records returned by the free IPO sources');

  const providerStatus = {
    nseMarket: nseMarket.status,
    bseSensex: bseSensex.status,
    yahoo: yahoo.status,
    giftNifty: giftNifty.status,
    tradingView: tv.status,
    metals: metals.status,
    news: news.status,
    nseIpo: nseIpoRecords.length ? 'fulfilled' : 'rejected'
  };

  const dataset = {
    updatedAt: NOW,
    refreshWindow: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours',
    timezone: 'Asia/Kolkata',
    marketSession: {
      indiaDate: session.date,
      cashMarketClosed: session.afterCashClose,
      closeFinalization: session.afterCashClose ? 'Exchange EOD close attempted' : 'Intraday exchange quote'
    },
    source: 'API-only shared feed — free public/exchange sources',
    refresh: {
      status: 'ok',
      updatedAt: NOW,
      cadence: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours',
      partial: errors.length > 0,
      errors,
      providerStatus
    },
    dataPolicy: {
      primary: 'API-only',
      noSnapshotFallback: true,
      noPerVisitorProviderCalls: true,
      replaceOldDataOnSuccessfulRefresh: true,
      noPaidApiKeysRequired: true,
      refreshCadence: 'market hourly 10:00-17:00 IST Mon-Fri; IPO/FII-DII every 2 hours',
      indianEquities: 'NSE/BSE public exchange feeds only',
      ipo: 'NSE official public IPO issue list + per-issue NSE Issue Information; GMP deferred',
      metals: 'OroPocket India gold/silver buy quotes in INR per gram; no synthetic USD-to-INR conversion',
      energy: 'TradingView public scanner for ICE Brent, NYMEX WTI and NYMEX Henry Hub futures'
    },
    market: { indices, global, commodities, stocks },
    fiiDii: fii,
    ipo: { mainboard, sme },
    news: news.status === 'fulfilled' ? news.value : []
  };

  const usableRecords = dataset.market.indices.length + dataset.market.global.length + dataset.market.commodities.length + dataset.market.stocks.length + dataset.ipo.mainboard.length + dataset.ipo.sme.length + dataset.news.length;
  if (usableRecords < 3) {
    // Do not write an empty or fake financial snapshot. The GitHub job fails,
    // and the last successful dataset remains untouched on the static site.
    throw new Error(`No usable API data returned. ${errors.join(' | ')}`);
  }

  await writeDataset(dataset);
  console.log(JSON.stringify({
    ok: true,
    updatedAt: NOW,
    partial: errors.length > 0,
    indices: indices.length,
    global: global.length,
    commodities: commodities.length,
    stocks: stocks.length,
    mainboard: mainboard.length,
    sme: sme.length,
    news: dataset.news.length,
    errors
  }, null, 2));
} catch (error) {
  console.error(`REFRESH FAILED: ${error.message}`);
  process.exit(1);
}
