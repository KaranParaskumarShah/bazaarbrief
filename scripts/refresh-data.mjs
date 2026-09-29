import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('public/data/latest.json');
const now = new Date().toISOString();
const NSE_BASE = 'https://www.nseindia.com';
const NSE_PAGE = `${NSE_BASE}/market-data/all-upcoming-issues-ipo`;
const REQUEST_TIMEOUT = 12000;
const FINAPI_IPO_URL = 'https://finapi.upvaly.com/api/ipo';
const GMP_TODAY_URL = 'https://gmptoday.in/api/gmp.json';
const GMP_GITHUB_URL = 'https://raw.githubusercontent.com/Spectrumz00/india-ipo-gmp-data/main/data/gmp-latest.json';

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(String(v).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(x) ? x : null;
};
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const ipoMatchKey = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/\b(private|pvt|limited|ltd|india|inc|ipo|company|co)\b/g, '').replace(/[^a-z0-9]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const changePct = (value, previous) => value != null && previous ? ((value - previous) / previous) * 100 : null;
const changePts = (value, previous) => value != null && previous != null ? value - previous : null;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? REQUEST_TIMEOUT);
  try {
    const r = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
        ...(options.headers || {})
      }
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      Accept: 'text/html,text/plain,application/rss+xml,application/xml,*/*',
      'User-Agent': 'BazaarBrief/4.0 (+https://bazaarbrief.in)',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(options.timeout ?? REQUEST_TIMEOUT)
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.text();
}

function yahooSymbolResult(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo returned no chart result for ${symbol}`);
  const meta = result.meta || {};
  const value = num(meta.regularMarketPrice ?? meta.previousClose);
  if (value == null) throw new Error(`Yahoo returned no price for ${symbol}`);
  const previous = num(meta.previousClose);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps.map((t, i) => ({
    t: new Date(t * 1000).toISOString(),
    v: num(closes[i])
  })).filter(x => x.v != null).slice(-48);
  const marketTime = meta.regularMarketTime || timestamps[timestamps.length - 1];
  return {
    value,
    change: changePts(value, previous),
    pct: changePct(value, previous),
    asOf: marketTime ? new Date(marketTime * 1000).toISOString() : null,
    currency: meta.currency || null,
    providerSymbol: symbol,
    source: 'Yahoo Finance public chart feed',
    series
  };
}

async function yahooQuote(name, symbol, kind = 'market') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=true`;
  const payload = await fetchJson(url);
  return { name, kind, ...yahooSymbolResult(payload, symbol) };
}

async function allYahooQuotes(defs) {
  const settled = await Promise.allSettled(defs.map(d => yahooQuote(d.name, d.symbol, d.kind)));
  const good = [];
  const errors = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') good.push(r.value);
    else errors.push(`${defs[i].name}: ${r.reason?.message || r.reason}`);
  });
  return { good, errors };
}

async function tradingViewScan(tickers) {
  const payload = {
    symbols: { tickers },
    columns: ['close', 'change', 'change_abs', 'currency', 'description']
  };
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      Origin: 'https://www.tradingview.com',
      Referer: 'https://www.tradingview.com/'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });
  if (!r.ok) throw new Error(`TradingView scanner HTTP ${r.status}`);
  const json = await r.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchGiftNifty() {
  const tickers = [
    'NSEIX:NIFTY1!',
    'NSEIX:NIFTY1!@1'
  ];
  const rows = await tradingViewScan(tickers);
  const row = rows.find(x => String(x?.s || '').toUpperCase() === 'NSEIX:NIFTY1!') || rows[0];
  if (!row?.d?.length) throw new Error('TradingView did not return GIFT Nifty');
  const [value, pct, change] = row.d;
  const price = num(value);
  if (price == null) throw new Error('TradingView GIFT Nifty returned no price');
  return {
    name: 'GIFT NIFTY',
    value: price,
    change: num(change),
    pct: num(pct),
    kind: 'futures',
    asOf: null,
    asOfKind: 'provider timestamp unavailable',
    source: 'TradingView public scanner · NSE International Exchange',
    note: 'GIFT Nifty futures indicator; quote may be delayed by the source.'
  };
}

async function fetchTradingViewMarket() {
  const defs = [
    ['S&P 500', 'SP:SPX', 'index'],
    ['NASDAQ 100', 'NASDAQ:NDX', 'index'],
    ['FTSE 100', 'TVC:UKX', 'index'],
    ['HANG SENG', 'TVC:HSI', 'index'],
    ['USD/INR', 'FX_IDC:USDINR', 'fx'],
    ['BRENT', 'TVC:UKOIL', 'commodity'],
    ['WTI', 'TVC:USOIL', 'commodity'],
    ['NATURAL GAS', 'TVC:NGAS', 'commodity']
  ];
  const rows = await tradingViewScan(defs.map(x => x[1]));
  const byTicker = new Map(rows.map(x => [String(x?.s || '').toUpperCase(), x]));
  const good = [];
  for (const [name, ticker, kind] of defs) {
    const row = byTicker.get(ticker.toUpperCase());
    if (!row?.d?.length) continue;
    const [value, pct, change, currency] = row.d;
    const price = num(value);
    if (price == null) continue;
    good.push({
      name, value: price, pct: num(pct), change: num(change), kind,
      currency: currency || null, asOf: null,
      asOfKind: 'provider timestamp unavailable',
      source: 'TradingView public scanner'
    });
  }
  if (!good.length) throw new Error('TradingView market scanner returned no usable rows');
  return good;
}

function nseHeaders(cookie = '') {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: NSE_PAGE,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function createNseSession() {
  const r = await fetch(NSE_PAGE, { headers: nseHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!r.ok) throw new Error(`NSE session HTTP ${r.status}`);
  const cookies = r.headers.getSetCookie?.() || [];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function nseGet(pathname, cookie, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${NSE_BASE}${pathname}`, {
        headers: nseHeaders(cookie),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT)
      });
      if (!r.ok) throw new Error(`${pathname} -> HTTP ${r.status}`);
      return r.json();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(900 * (i + 1));
    }
  }
  throw last;
}

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Table)) return payload.Table;
  if (Array.isArray(payload?.table)) return payload.table;
  return [];
}

function normalizeIndexRow(row, fallbackName) {
  const name = row?.indexName || row?.name || fallbackName;
  const value = num(row?.last ?? row?.lastPrice ?? row?.ltp ?? row?.indexValue ?? row?.price);
  const previous = num(row?.previousClose ?? row?.prevClose ?? row?.close);
  const change = num(row?.change ?? row?.netChange) ?? changePts(value, previous);
  const pct = num(row?.percentChange ?? row?.pChange ?? row?.perChange) ?? changePct(value, previous);
  if (value == null) return null;
  return {
    name,
    value,
    change,
    pct,
    kind: name === 'GIFT NIFTY' ? 'futures' : 'index',
    asOf: row?.timeVal || row?.timestamp || row?.lastUpdateTime || now,
    source: 'NSE India public market feed',
    priceType: 'intraday_ltp',
    finalized: false,
    sessionStatus: 'open_or_live'
  };
}

function indiaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = type => parts.find(x => x.type === type)?.value;
  const year = Number(get('year')), month = Number(get('month')), day = Number(get('day'));
  const hour = Number(get('hour')), minute = Number(get('minute'));
  return { year, month, day, hour, minute, date: `${get('year')}-${get('month')}-${get('day')}`, afterCashClose: hour > 15 || (hour === 15 && minute >= 45) };
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function ddmmyyyy(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function normalizeHistoricalNseClose(row, fallbackName) {
  const value = num(row?.EOD_CLOSE_INDEX_VAL ?? row?.CLOSE_INDEX_VAL ?? row?.close ?? row?.Close);
  if (value == null) return null;
  const dateRaw = row?.EOD_TIMESTAMP ?? row?.TIMESTAMP ?? row?.date ?? row?.Date;
  const date = toISO(dateRaw) || String(dateRaw || '').slice(0, 10);
  const previous = num(row?.PREV_CLOSE ?? row?.PREV_CLOSE_INDEX_VAL ?? row?.prevClose);
  return {
    name: fallbackName,
    value,
    change: changePts(value, previous),
    pct: changePct(value, previous),
    closeDate: date,
    priceType: 'official_eod_close',
    finalized: true,
    source: 'NSE historical index close',
    asOf: date ? `${date}T15:30:00+05:30` : null
  };
}

async function fetchNseHistoricalIndexCloses(cookie) {
  if (!cookie) throw new Error('NSE session unavailable for historical index close');
  const end = indiaNow().date;
  const start = dateDaysAgo(7);
  const names = [
    ['NIFTY%2050', 'NIFTY 50'],
    ['NIFTY%20BANK', 'BANK NIFTY']
  ];
  const output = {};
  for (const [indexType, name] of names) {
    try {
      const payload = await nseGet(`/api/historical/indicesHistory?indexType=${indexType}&from=${ddmmyyyy(start)}&to=${ddmmyyyy(end)}`, cookie);
      const rows = payload?.data?.indexCloseOnlineRecords || payload?.indexCloseOnlineRecords || unwrapRows(payload);
      const normalized = (Array.isArray(rows) ? rows : [])
        .map(r => normalizeHistoricalNseClose(r, name))
        .filter(Boolean)
        .sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate)));
      if (normalized.length) output[name] = normalized[normalized.length - 1];
    } catch (e) {
      throw new Error(`${name} EOD close: ${e.message}`);
    }
  }
  if (!Object.keys(output).length) throw new Error('NSE historical index API returned no EOD closes');
  return output;
}

async function fetchNseIndiaMarket() {
  const cookie = await createNseSession();
  const [allIndices, nifty50, bankNifty] = await Promise.all([
    nseGet('/api/allIndices', cookie),
    nseGet('/api/equity-stockIndices?index=NIFTY%2050', cookie),
    nseGet('/api/equity-stockIndices?index=NIFTY%20BANK', cookie)
  ]);

  const indexRows = unwrapRows(allIndices);
  const findIndex = re => indexRows.find(r => re.test(String(r?.indexName || r?.name || '')));
  const niftyRow = findIndex(/^NIFTY 50$/i) || unwrapRows(nifty50).find(r => /^NIFTY 50$/i.test(String(r?.indexName || r?.name || '')));
  const bankRow = findIndex(/NIFTY BANK/i) || unwrapRows(bankNifty).find(r => /NIFTY BANK/i.test(String(r?.indexName || r?.name || '')));
  const indices = [
    normalizeIndexRow(niftyRow, 'NIFTY 50'),
    normalizeIndexRow(bankRow, 'BANK NIFTY')
  ].filter(Boolean);

  const stocks = unwrapRows(nifty50)
    .filter(r => r?.symbol && r?.lastPrice != null)
    .map(r => ({
      symbol: String(r.symbol),
      name: r.meta?.companyName || r.companyName || r.symbol,
      price: num(r.lastPrice),
      pct: num(r.pChange ?? r.percentChange),
      change: num(r.change),
      source: 'NSE India public market feed',
      asOf: r.lastUpdateTime || now
    }))
    .filter(r => r.price != null);

  return { cookie, indices, stocks };
}

async function fetchBseHistoricalSensexClose() {
  const end = indiaNow().date;
  const start = dateDaysAgo(7);
  const url = `https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAll/w?fmdt=${ddmmyyyy(start)}&todt=${ddmmyyyy(end)}&index=All&period=D`;
  const payload = await fetchJson(url, {
    headers: { Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' }
  });
  const rows = unwrapRows(payload);
  const sensexRows = rows.filter(r => /SENSEX/i.test(String(r?.IndexName || r?.indexName || r?.Index || r?.Name || '')));
  const normalized = sensexRows.map(r => {
    const value = num(r?.Close ?? r?.CLOSE ?? r?.IndexClose ?? r?.CloseValue);
    const previous = num(r?.PrevClose ?? r?.PREVCLOSE ?? r?.PreviousClose);
    const dateRaw = r?.Date ?? r?.DATE ?? r?.DateTime;
    if (value == null) return null;
    return {
      name: 'SENSEX', value, change: num(r?.Change) ?? changePts(value, previous),
      pct: num(r?.['Change %'] ?? r?.ChangePercent) ?? changePct(value, previous),
      closeDate: toISO(dateRaw) || String(dateRaw || '').slice(0, 10),
      priceType: 'official_eod_close', finalized: true,
      source: 'BSE historical index close', asOf: dateRaw || null
    };
  }).filter(Boolean).sort((a,b) => String(a.closeDate).localeCompare(String(b.closeDate)));
  if (!normalized.length) throw new Error('BSE historical SENSEX feed returned no close');
  return normalized[normalized.length - 1];
}

async function fetchBseSensex() {
  const payload = await fetchJson('https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w', {
    headers: { Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' }
  });
  const row = unwrapRows(payload)[0] || payload?.data?.[0] || payload?.Table?.[0] || payload;
  const value = num(row?.LTP ?? row?.ltp ?? row?.Ltp ?? row?.Value);
  const previous = num(row?.PrevClose ?? row?.prevClose ?? row?.PreviousClose);
  if (value == null) throw new Error('BSE SENSEX feed returned no LTP');
  return {
    name: 'SENSEX', value,
    change: num(row?.Change ?? row?.change) ?? changePts(value, previous),
    pct: num(row?.['Change %'] ?? row?.ChangePercent ?? row?.changePercent) ?? changePct(value, previous),
    kind: 'index',
    asOf: row?.DateTime || now,
    source: 'BSE India public SENSEX feed',
    priceType: 'intraday_ltp',
    finalized: false,
    sessionStatus: 'open_or_live'
  };
}

async function fetchGoldApi() {
  const [gold, silver] = await Promise.all([
    fetchJson('https://api.gold-api.com/price/XAU'),
    fetchJson('https://api.gold-api.com/price/XAG')
  ]);
  return { gold, silver };
}

async function fetchFx() {
  return fetchJson('https://api.frankfurter.app/latest?from=USD&to=INR');
}

function metalInr(usdPerTroyOz, usdInr, unit) {
  if (usdPerTroyOz == null || usdInr == null) return null;
  if (unit === '₹/10g') return usdPerTroyOz * usdInr * 10 / 31.1034768;
  if (unit === '₹/kg') return usdPerTroyOz * usdInr * 1000 / 31.1034768;
  return null;
}

async function fetchFiiDii(cookie) {
  if (!cookie) throw new Error('NSE session unavailable for FII/DII');
  const rows = unwrapRows(await nseGet('/api/fiidiiTradeReact', cookie));
  const fii = rows.find(x => /FII|FPI/i.test(String(x.category || x.clientType || x.type || '')));
  const dii = rows.find(x => /DII/i.test(String(x.category || x.clientType || x.type || '')));
  const readNet = x => num(x?.netValue ?? x?.net ?? x?.netValueInCr ?? x?.netValueCr ?? x?.netValueInCr);
  if (!fii && !dii) throw new Error('NSE FII/DII response did not contain recognised categories');
  return {
    fii: readNet(fii), dii: readNet(dii),
    date: fii?.date || dii?.date || new Date().toISOString().slice(0, 10),
    source: 'NSE India public FII/DII endpoint', asOf: now
  };
}

async function fetchIndianStocksFallback() {
  const symbols = ['RELIANCE.NS','HDFCBANK.NS','ICICIBANK.NS','INFY.NS','TCS.NS','SBIN.NS','BHARTIARTL.NS','ITC.NS','LT.NS','AXISBANK.NS','KOTAKBANK.NS','HINDUNILVR.NS','MARUTI.NS','SUNPHARMA.NS','TITAN.NS','M&M.NS','BAJFINANCE.NS','ADANIENT.NS','NTPC.NS','POWERGRID.NS','TATAMOTORS.NS','TRENT.NS','BEL.NS','DRREDDY.NS','HCLTECH.NS','TECHM.NS','WIPRO.NS','ONGC.NS','COALINDIA.NS','ADANIPORTS.NS','HINDALCO.NS','JSWSTEEL.NS'];
  const url = `http://65.0.104.9/stock/list?symbols=${encodeURIComponent(symbols.join(','))}&res=num`;
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload) ? payload : (payload.stocks || payload.data || []);
  if (!rows.length) throw new Error('Indian stock free fallback returned no rows');
  return rows.map(x => ({
    symbol: String(x.symbol || x.ticker || '').replace(/\.NS$/i, ''),
    name: x.name || x.companyName || x.symbol,
    price: num(x.price ?? x.currentPrice ?? x.lastPrice ?? x.ltp),
    pct: num(x.changePercent ?? x.pctChange ?? x.percentChange ?? x.pct),
    change: num(x.change ?? x.changeValue),
    source: 'Indian Stock Market API fallback', asOf: x.asOf || x.timestamp || now
  })).filter(x => x.symbol && x.price != null);
}

function parseRss(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);
  return items.map(m => {
    const block = m[1];
    const pick = tag => {
      const hit = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return hit ? hit[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
    };
    return { tag: 'MARKET NEWS', title: pick('title'), source: 'Google News RSS', age: pick('pubDate'), url: pick('link') };
  }).filter(x => x.title);
}

async function fetchNews() {
  const xml = await fetchText('https://news.google.com/rss/search?q=Indian%20stock%20market%20Nifty%20Sensex%20IPO&hl=en-IN&gl=IN&ceid=IN:en');
  return parseRss(xml);
}

function toISO(value) {
  if (!value) return null;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function parseBand(value) {
  const text = String(value ?? '');
  const nums = [...text.matchAll(/\d[\d,.]*/g)].map(m => num(m[0])).filter(v => v != null);
  if (!nums.length) return { min: null, max: null };
  let min = nums[0], max = nums[1] ?? nums[0];
  if (max > 0 && max < 10) { min *= 1000; max *= 1000; }
  return { min, max };
}


function ipoStatus(openDate, closeDate, explicitStatus) {
  const s = String(explicitStatus || '').toLowerCase();
  if (s.includes('open') || s.includes('live') || s === 'u') return 'Open';
  if (s.includes('upcoming') || s === 'upcoming') return 'Upcoming';
  if (s.includes('closed')) return 'Closed';
  if (s.includes('listed')) return 'Listed';
  const today = indiaNow().date;
  if (openDate && openDate <= today && (!closeDate || closeDate >= today)) return 'Open';
  if (closeDate && closeDate < today) return 'Closed';
  return 'Upcoming';
}

function cleanText(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return t || null;
}

function firstValue(...values) {
  return values.find(v => v !== null && v !== undefined && String(v).trim() !== '');
}

function extractNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? num(m[0]) : null;
}

function parseBoard(raw) {
  const text = String(firstValue(raw.type, raw.issueType, raw.issue_type, raw.board, raw.segment, raw.category, raw.exchange, raw.sub_type, raw.series) || '').toLowerCase();
  return text.includes('sme') || raw.isSme === true || raw.is_sme === true ? 'SME' : 'Mainboard';
}

function normalizeIpoRecord(raw, sourceLabel = 'NSE India public IPO feed') {
  const company = cleanText(firstValue(raw.name, raw.companyName, raw.company, raw.ipoName, raw.title, raw.symbol)) || 'IPO';
  const board = parseBoard(raw);
  const bandRaw = firstValue(raw.price_band, raw.priceBand, raw.priceRange, raw.price_range, raw.issuePrice, raw.issue_price, raw.price, `${raw.minimum_price ?? raw.minPrice ?? ''}-${raw.maximum_price ?? raw.maxPrice ?? ''}`);
  const band = parseBand(bandRaw);
  const lot = extractNumber(firstValue(raw.lot_size, raw.lotSize, raw.minBidQuantity, raw.min_bid_quantity, raw.lot, raw.minimum_lot));
  const openDate = toISO(firstValue(raw.open_date, raw.openDate, raw.issueStartDate, raw.bidding_start_date, raw.startDate, raw.biddingStartDate));
  const closeDate = toISO(firstValue(raw.close_date, raw.closeDate, raw.issueEndDate, raw.bidding_end_date, raw.endDate, raw.biddingEndDate));
  const issueSizeRaw = firstValue(raw.issue_size, raw.issueSize, raw.issue_size_cr, raw.issueSizeCr, raw.issueSizeValue);
  const issueSizeCr = extractNumber(issueSizeRaw);
  const minInvestment = extractNumber(firstValue(raw.min_investment, raw.minimumInvestment, raw.minInvestment, raw.minimum_investment));
  const subscriptionObj = raw.subscription && typeof raw.subscription === 'object' ? raw.subscription : {};
  const subscription = extractNumber(firstValue(subscriptionObj.total, raw.subscription_total, raw.subscriptionTotal, raw.total_subscription, raw.overall_subscription, raw.subscription_multiple, raw.subs, raw.subscription, raw.subscribed));
  const qib = extractNumber(firstValue(subscriptionObj.qib, raw.qib));
  const nii = extractNumber(firstValue(subscriptionObj.nii, subscriptionObj.hni, raw.nii, raw.hni));
  const retail = extractNumber(firstValue(subscriptionObj.retail, raw.retail));
  const gmpObj = raw.gmp && typeof raw.gmp === 'object' ? raw.gmp : {};
  const gmp = extractNumber(firstValue(gmpObj.price, gmpObj.value, raw.gmp_price, raw.gmpPrice, raw.gmp, raw.gmp_median, raw.median_gmp, raw.gmpMedian, raw.median, raw.premium));
  const gmpPct = extractNumber(firstValue(gmpObj.percentage, gmpObj.percent, raw.gmp_percentage, raw.gmpPercent, raw.gmp_pct, raw.gmpPercent, raw.estimated_gain, raw.estimated_gain_pct));
  const issuePrice = band.max ?? extractNumber(firstValue(raw.issue_price, raw.issuePrice));
  const min = minInvestment ?? (issuePrice != null && lot != null ? issuePrice * lot : null);
  const issue = issueSizeRaw != null ? cleanText(issueSizeRaw) : issueSizeCr != null ? `₹${issueSizeCr.toLocaleString('en-IN')} Cr` : '—';
  return {
    slug: slugify(company), symbol: cleanText(firstValue(raw.symbol, raw.scrip, raw.code)), name: company, type: board,
    status: ipoStatus(openDate, closeDate, firstValue(raw.status, raw.state)),
    exchange: cleanText(firstValue(raw.listing_on, raw.listingOn, raw.exchange, raw.exchangeName)) || (board === 'SME' ? 'NSE/BSE SME' : 'NSE/BSE'),
    band: band.min != null ? `₹${band.min.toLocaleString('en-IN')} – ₹${band.max.toLocaleString('en-IN')}` : '—',
    priceBand: band, lot: lot || 0, lotSize: lot || 0, min, issue, issueSizeCr,
    open: openDate || '—', close: closeDate || '—', openDate, closeDate,
    allotment: toISO(firstValue(raw.allotment_date, raw.allotmentDate)),
    refund: toISO(firstValue(raw.refund_date, raw.refundDate)),
    credit: toISO(firstValue(raw.credit_date, raw.creditDate, raw.demat_credit_date)),
    listing: toISO(firstValue(raw.listing_date, raw.listingDate)),
    listingDate: toISO(firstValue(raw.listing_date, raw.listingDate)),
    listingPrice: extractNumber(firstValue(raw.listing_price, raw.listingPrice)),
    faceValue: cleanText(firstValue(raw.face_value, raw.faceValue)),
    registrar: cleanText(firstValue(raw.registrar, raw.registrar_name)),
    leadManagers: cleanText(firstValue(raw.lead_managers, raw.leadManagers)),
    fresh: cleanText(firstValue(raw.fresh_issue, raw.freshIssue, raw.fresh)),
    ofs: cleanText(firstValue(raw.ofs, raw.offerForSale, raw.offer_for_sale)),
    saleType: cleanText(firstValue(raw.sale_type, raw.saleType)),
    sector: cleanText(firstValue(raw.industry, raw.sector)) || '—',
    objects: cleanText(firstValue(raw.objects, raw.object_of_issue, raw.issue_object)),
    revenue: cleanText(firstValue(raw.revenue)), profit: cleanText(firstValue(raw.profit, raw.pat)), debt: cleanText(firstValue(raw.debt, raw.borrowings)), promoters: cleanText(firstValue(raw.promoters)),
    subscription, qib, nii, retail,
    subscriptionUpdated: cleanText(firstValue(subscriptionObj.updated_at, raw.subscription_updated_at, raw.subscriptionUpdated)),
    gmp, gmpPct,
    gmpUpdated: cleanText(firstValue(gmpObj.updated_at, raw.gmp_updated_at, raw.gmpUpdated, raw.gmpLastUpdated, raw.gmp_updated_at, raw.updated_at)),
    gmpRange: cleanText(firstValue(gmpObj.range, raw.gmp_range, raw.gmpRange, raw.range)),
    gmpConfidence: cleanText(firstValue(raw.confidence, gmpObj.confidence)),
    gmpSources: extractNumber(firstValue(raw.sources, gmpObj.sources)),
    gmpSource: gmp != null ? 'GMP Today — median of public trackers; unofficial' : null,
    source: sourceLabel,
    sourceDate: indiaNow().date,
    asOf: firstValue(gmpObj.updated_at, subscriptionObj.updated_at, raw.updated_at, raw.updatedAt) || now
  };
}

function collectIpoLikeRows(payload, depth = 0, out = []) {
  if (depth > 4 || payload == null) return out;
  if (Array.isArray(payload)) {
    for (const item of payload) collectIpoLikeRows(item, depth + 1, out);
    return out;
  }
  if (typeof payload !== 'object') return out;
  const looksLikeIpo = ['name','company','companyName','ipoName','title','symbol'].some(k => payload[k] != null);
  if (looksLikeIpo) out.push(payload);
  for (const [key, value] of Object.entries(payload)) {
    if (['meta','config','disclaimer'].includes(key)) continue;
    if (Array.isArray(value) || (value && typeof value === 'object')) collectIpoLikeRows(value, depth + 1, out);
  }
  return out;
}

function mergeIpoRecords(...groups) {
  const map = new Map();
  const keyMap = new Map();
  for (const group of groups) {
    for (const item of group || []) {
      if (!item?.slug) continue;
      const key = ipoMatchKey(item.name);
      const existingKey = keyMap.get(key);
      const existing = map.get(item.slug) || (existingKey ? map.get(existingKey) : null);
      if (!existing) {
        map.set(item.slug, item);
        keyMap.set(key, item.slug);
        continue;
      }
      const merged = { ...existing };
      for (const [field, value] of Object.entries(item)) {
        const empty = value === null || value === undefined || value === '' || value === '—' || (typeof value === 'number' && Number.isNaN(value));
        if (!empty) merged[field] = value;
      }
      const official = existing.source?.includes('NSE') ? existing : item.source?.includes('NSE') ? item : null;
      const tracker = existing.source?.includes('GMP Today') ? existing : item.source?.includes('GMP Today') ? item : null;
      if (official && tracker) {
        Object.assign(merged, {
          name: official.name || tracker.name,
          symbol: official.symbol || tracker.symbol,
          type: official.type,
          band: official.band !== '—' ? official.band : tracker.band,
          priceBand: official.priceBand?.min != null ? official.priceBand : tracker.priceBand,
          lot: official.lot || tracker.lot, lotSize: official.lotSize || tracker.lotSize,
          min: official.min ?? tracker.min, issue: official.issue !== '—' ? official.issue : tracker.issue,
          openDate: official.openDate || tracker.openDate, closeDate: official.closeDate || tracker.closeDate,
          open: official.open !== '—' ? official.open : tracker.open, close: official.close !== '—' ? official.close : tracker.close,
          allotment: official.allotment || tracker.allotment, listing: official.listing || tracker.listing,
          exchange: official.exchange || tracker.exchange,
          source: 'NSE official IPO details + GMP Today free public tracker',
          sourceDate: indiaNow().date,
          asOf: tracker.gmpUpdated || tracker.asOf || official.asOf
        });
      }
      map.delete(existing.slug);
      map.set(merged.slug || existing.slug, merged);
      keyMap.set(key, merged.slug || existing.slug);
    }
  }
  return [...map.values()];
}

async function fetchJsonWithRetries(url, options = {}, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try { return await fetchJson(url, options); }
    catch (e) { lastError = e; if (i < attempts - 1) await sleep(700 * (i + 1)); }
  }
  throw lastError;
}

function extractIpoArray(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.ipos)) return payload.ipos;
  if (Array.isArray(payload?.open)) return payload.open;
  if (Array.isArray(payload?.upcoming)) return payload.upcoming;
  return collectIpoLikeRows(payload);
}

async function fetchFinApiIpos() {
  const payload = await fetchJsonWithRetries(FINAPI_IPO_URL, { timeout: 15000, headers: { Accept: 'application/json' } }, 2);
  const rows = extractIpoArray(payload);
  const normalized = rows.map(r => normalizeIpoRecord(r, 'FinAPI free IPO feed')).filter(x => x.name !== 'IPO');
  if (!normalized.length) throw new Error('FinAPI returned no normalizable IPO records');
  return normalized;
}

async function fetchGmpTodayIpos() {
  const payload = await fetchJsonWithRetries(GMP_TODAY_URL, { timeout: 15000, headers: { Accept: 'application/json' } }, 2);
  const rows = extractIpoArray(payload);
  const normalized = rows.map(r => normalizeIpoRecord(r, 'GMP Today free public dataset')).filter(x => x.name !== 'IPO');
  if (!normalized.length) throw new Error('GMP Today returned no normalizable IPO records');
  return normalized;
}

async function fetchGmpGithubIpos() {
  const payload = await fetchJsonWithRetries(GMP_GITHUB_URL, { timeout: 15000, headers: { Accept: 'application/json' } }, 2);
  const rows = extractIpoArray(payload);
  const normalized = rows.map(r => normalizeIpoRecord(r, 'GMP Today open dataset mirror')).filter(x => x.name !== 'IPO');
  if (!normalized.length) throw new Error('GMP GitHub mirror returned no normalizable IPO records');
  return normalized;
}

async function fetchFreeIpoData() {
  const results = await Promise.allSettled([fetchFinApiIpos(), fetchGmpTodayIpos(), fetchGmpGithubIpos()]);
  const records = [];
  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled') records.push(...r.value);
    else errors.push(r.reason?.message || String(r.reason));
  }
  const merged = mergeIpoRecords(...records);
  if (!merged.length) throw new Error(`All free IPO sources failed: ${errors.join(' | ')}`);
  return { records: merged, errors };
}

function baseIpo(raw, status) {
  return normalizeIpoRecord({ ...raw, status }, 'NSE India public IPO feed');
}

async function fetchNseIpos(cookie) {
  if (!cookie) throw new Error('NSE session unavailable for IPO feed');
  const [currentPayload, upcomingPayload] = await Promise.all([
    nseGet('/api/ipo-current-issue', cookie),
    nseGet('/api/all-upcoming-issues?category=ipo', cookie)
  ]);
  const current = unwrapRows(currentPayload);
  const upcoming = unwrapRows(upcomingPayload);
  const records = [...upcoming, ...current].map(raw => baseIpo(raw)).filter(x => x.name !== 'IPO');
  return mergeIpoRecords(records).filter(x => x.type === 'Mainboard' || x.type === 'SME');
}

async function writeDataset(result) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
}

const errors = [];

try {
  // Indian exchange data is fetched from the exchanges first. Yahoo is a fallback
  // for the Indian indices/GIFT and the primary source for global markets/commodities.
  const [nseMarket, bseSensex, yahoo, giftNifty, tvMarket, metals, fx, fiiDii, news, freeIpoResult] = await Promise.allSettled([
    fetchNseIndiaMarket(),
    fetchBseSensex(),
    allYahooQuotes([
      { name: 'NIFTY 50', symbol: '^NSEI', kind: 'index' },
      { name: 'SENSEX', symbol: '^BSESN', kind: 'index' },
      { name: 'BANK NIFTY', symbol: '^NSEBANK', kind: 'index' },
      { name: 'GIFT NIFTY', symbol: process.env.GIFT_NIFTY_SYMBOL || 'NIFTY1!', kind: 'futures' },
      { name: 'S&P 500', symbol: '^GSPC', kind: 'index' },
      { name: 'NASDAQ 100', symbol: '^NDX', kind: 'index' },
      { name: 'FTSE 100', symbol: '^FTSE', kind: 'index' },
      { name: 'HANG SENG', symbol: '^HSI', kind: 'index' },
      { name: 'USD/INR', symbol: 'INR=X', kind: 'fx' },
      { name: 'BRENT', symbol: 'BZ=F', kind: 'commodity' },
      { name: 'WTI', symbol: 'CL=F', kind: 'commodity' },
      { name: 'NATURAL GAS', symbol: 'NG=F', kind: 'commodity' }
    ]),
    fetchGiftNifty(),
    fetchTradingViewMarket(),
    fetchGoldApi(), fetchFx(), Promise.resolve(null), fetchNews(), fetchFreeIpoData()
  ]);

  const yahooGood = yahoo.status === 'fulfilled' ? yahoo.value.good : [];
  const yahooErrors = yahoo.status === 'fulfilled' ? yahoo.value.errors : [yahoo.reason?.message || String(yahoo.reason)];
  errors.push(...yahooErrors.map(e => `Yahoo: ${e}`));
  const byName = new Map(yahooGood.map(x => [x.name, x]));

  let nse = null;
  if (nseMarket.status === 'fulfilled') nse = nseMarket.value;
  else errors.push(`NSE market: ${nseMarket.reason?.message || nseMarket.reason}`);
  if (bseSensex.status === 'rejected') errors.push(`BSE SENSEX: ${bseSensex.reason?.message || bseSensex.reason}`);
  if (metals.status === 'rejected') errors.push(`Gold API: ${metals.reason?.message || metals.reason}`);
  if (fx.status === 'rejected') errors.push(`FX: ${fx.reason?.message || fx.reason}`);
  if (news.status === 'rejected') errors.push(`News: ${news.reason?.message || news.reason}`);
  if (giftNifty.status === 'rejected') errors.push(`GIFT Nifty: ${giftNifty.reason?.message || giftNifty.reason}`);
  if (tvMarket.status === 'rejected') errors.push(`TradingView market: ${tvMarket.reason?.message || tvMarket.reason}`);

  const session = indiaNow();
  let nseEod = {};
  let bseEod = null;
  // During market hours, show the current exchange quote. Once the cash market
  // is closed, switch to the exchange's historical EOD close. This prevents a
  // stale/future provider value from being presented as the official close.
  if (session.afterCashClose) {
    if (nse?.cookie) {
      try { nseEod = await fetchNseHistoricalIndexCloses(nse.cookie); }
      catch (e) { errors.push(`NSE EOD finalization: ${e.message}`); }
    }
    try { bseEod = await fetchBseHistoricalSensexClose(); }
    catch (e) { errors.push(`BSE EOD finalization: ${e.message}`); }
  }

  const nseByName = new Map((nse?.indices || []).map(x => [x.name, x]));
  const liveNifty = nseByName.get('NIFTY 50') || byName.get('NIFTY 50') || null;
  const liveBank = nseByName.get('BANK NIFTY') || byName.get('BANK NIFTY') || null;
  const liveSensex = bseSensex.status === 'fulfilled' ? bseSensex.value : (byName.get('SENSEX') || null);
  const finalNifty = session.afterCashClose ? (nseEod['NIFTY 50'] || null) : null;
  const finalBank = session.afterCashClose ? (nseEod['BANK NIFTY'] || null) : null;
  const finalSensex = session.afterCashClose ? bseEod : null;
  const indices = [
    finalNifty ? { ...liveNifty, ...finalNifty, sessionStatus: 'closed', note: `Final NSE close for ${finalNifty.closeDate}` } : liveNifty,
    finalSensex ? { ...liveSensex, ...finalSensex, sessionStatus: 'closed', note: `Final BSE close for ${finalSensex.closeDate}` } : liveSensex,
    finalBank ? { ...liveBank, ...finalBank, sessionStatus: 'closed', note: `Final NSE close for ${finalBank.closeDate}` } : liveBank,
    giftNifty.status === 'fulfilled' ? giftNifty.value : (byName.get('GIFT NIFTY') || null)
  ].filter(Boolean);

  const tvGood = tvMarket.status === 'fulfilled' ? tvMarket.value : [];
  const tvByName = new Map(tvGood.map(x => [x.name, x]));
  // Use one provider family for global indices/FX/energy so values are not mixed
  // across timestamps. TradingView is only a fallback here.
  const global = ['S&P 500','NASDAQ 100','FTSE 100','HANG SENG'].map(n => byName.get(n) || tvByName.get(n)).filter(Boolean);
  const usdInr = byName.get('USD/INR') || tvByName.get('USD/INR');
  const fxRate = usdInr?.value ?? (fx.status === 'fulfilled' ? num(fx.value?.rates?.INR) : null);
  const commodities = [];
  if (usdInr) commodities.push({ name: 'USD/INR', ...usdInr, unit: '₹' });
  const metalsPayload = metals.status === 'fulfilled' ? metals.value : null;
  const metalFx = fxRate;
  const goldUsd = num(metalsPayload?.gold?.price);
  const silverUsd = num(metalsPayload?.silver?.price);
  const goldUpdated = metalsPayload?.gold?.updatedAt || null;
  const silverUpdated = metalsPayload?.silver?.updatedAt || null;
  if (goldUsd != null && metalFx != null) commodities.push({
    name: 'GOLD', value: goldUsd, unit: '$/oz', pct: num(metalsPayload?.gold?.changePercent), change: num(metalsPayload?.gold?.change),
    asOf: goldUpdated, source: 'Gold-API live XAU spot', precious: true,
    usdPerOz: goldUsd, inrPer10g: metalInr(goldUsd, metalFx, '₹/10g'), fxRate: metalFx, fxAsOf: usdInr?.asOf || null,
    displayUnit: '$/troy oz + ₹/10g'
  });
  if (silverUsd != null && metalFx != null) commodities.push({
    name: 'SILVER', value: silverUsd, unit: '$/oz', pct: num(metalsPayload?.silver?.changePercent), change: num(metalsPayload?.silver?.change),
    asOf: silverUpdated, source: 'Gold-API live XAG spot', precious: true,
    usdPerOz: silverUsd, inrPerKg: metalInr(silverUsd, metalFx, '₹/kg'), fxRate: metalFx, fxAsOf: usdInr?.asOf || null,
    displayUnit: '$/troy oz + ₹/kg'
  });
  if (metals.status === 'rejected') errors.push(`Gold/Silver API: ${metals.reason?.message || metals.reason}`);
  for (const name of ['BRENT','WTI','NATURAL GAS']) {
    const q = byName.get(name) || tvByName.get(name);
    if (q) commodities.push({ name, ...q, unit: name === 'NATURAL GAS' ? '$/MMBtu' : '$/bbl' });
  }

  let stocks = nse?.stocks || [];
  if (stocks.length < 10) {
    try { stocks = await fetchIndianStocksFallback(); }
    catch (e) { errors.push(`Stock fallback: ${e.message}`); }
  }

  let fii = {};
  // Re-use the NSE session from the market request when available. A separate
  // session is created if the market request failed.
  try {
    let cookie = nse?.cookie;
    if (!cookie) cookie = await createNseSession();
    fii = await fetchFiiDii(cookie);
  } catch (e) { errors.push(`FII/DII: ${e.message}`); }

  let officialIpos = [];
  let freeIpoRecords = [];
  try {
    let cookie = nse?.cookie;
    if (!cookie) cookie = await createNseSession();
    officialIpos = await fetchNseIpos(cookie);
  } catch (e) {
    errors.push(`NSE IPO feed: ${e.message}`);
  }
  if (freeIpoResult.status === 'fulfilled') {
    freeIpoRecords = freeIpoResult.value.records || [];
    for (const e of freeIpoResult.value.errors || []) errors.push(`Free IPO source: ${e}`);
  } else {
    errors.push(`Free IPO sources: ${freeIpoResult.reason?.message || freeIpoResult.reason}`);
  }
  const mergedIpos = mergeIpoRecords(officialIpos, freeIpoRecords);
  const sortIpos = list => [...list].sort((a, b) => {
    const statusWeight = x => x === 'Open' ? 0 : 1;
    const sw = statusWeight(a.status) - statusWeight(b.status);
    if (sw) return sw;
    const ad = a.closeDate || a.openDate || '9999-12-31';
    const bd = b.closeDate || b.openDate || '9999-12-31';
    return String(ad).localeCompare(String(bd)) || String(a.name).localeCompare(String(b.name));
  });
  const mainboard = sortIpos(mergedIpos.filter(x => x.type === 'Mainboard' && ['Open','Upcoming'].includes(x.status)));
  const sme = sortIpos(mergedIpos.filter(x => x.type === 'SME' && ['Open','Upcoming'].includes(x.status)));
  if (!mainboard.length && !sme.length) errors.push('IPO: no open/upcoming IPO records were published');

  const providerStatus = {
    nseMarket: nseMarket.status, bseSensex: bseSensex.status, yahoo: yahoo.status,
    giftNifty: giftNifty.status, tradingView: tvMarket.status, metals: metals.status,
    fx: fx.status, news: news.status, ipo: freeIpoResult.status
  };

  const result = {
    updatedAt: now,
    refreshWindow: '10 minutes',
    timezone: 'Asia/Kolkata',
    marketSession: {
      indiaDate: session.date,
      cashMarketClosed: session.afterCashClose,
      closeFinalization: session.afterCashClose ? 'EOD exchange close attempted' : 'intraday exchange quote'
    },
    source: 'API-only shared feed — free public/exchange sources; no snapshot fallback',
    refresh: { status: 'ok', updatedAt: now, cadence: '10 minutes', partial: errors.length > 0, errors, providerStatus },
    dataPolicy: {
      primary: 'API-only', noSnapshotFallback: true, noPerVisitorProviderCalls: true,
      replaceOldDataOnSuccessfulRefresh: true, refreshCadence: '10 minutes', noPaidApiKeysRequired: true,
      indianEquitiesPrimary: 'NSE/BSE public exchange feeds; no snapshot fallback', giftNiftyPrimary: 'TradingView public scanner · NSE International Exchange', globalPrimary: 'Yahoo Finance public chart feed; TradingView fallback', ipoPrimary: 'FinAPI free IPO + GMP Today free public dataset + NSE official IPO details; no API key'
    },
    market: { indices, global, commodities, stocks },
    fiiDii: fii,
    ipo: { mainboard, sme },
    news: news.status === 'fulfilled' ? news.value : []
  };

  // Never fail the whole refresh because one free provider is blocked. Publish only
  // data actually returned by APIs. If absolutely no market/IPO/news data arrives,
  // keep the previous dataset instead of replacing it with an empty snapshot.
  const usableRecords = result.market.indices.length + result.market.global.length + result.market.commodities.length + result.market.stocks.length + result.ipo.mainboard.length + result.ipo.sme.length + result.news.length;
  if (usableRecords < 3) throw new Error(`No usable API data returned. Providers failed: ${errors.join(' | ')}`);
  await writeDataset(result);
  console.log(JSON.stringify({
    ok: true, updatedAt: now, errors,
    indices: result.market.indices.length, global: result.market.global.length,
    commodities: result.market.commodities.length, stocks: result.market.stocks.length,
    mainboard: mainboard.length, sme: sme.length, news: result.news.length
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
}
