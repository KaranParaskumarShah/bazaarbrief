import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('public/data/latest.json');
const now = new Date().toISOString();
const NSE_BASE = 'https://www.nseindia.com';
const NSE_PAGE = `${NSE_BASE}/market-data/all-upcoming-issues-ipo`;
const REQUEST_TIMEOUT = 12000;

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(String(v).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(x) ? x : null;
};
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

async function fetchXausMetals() {
  const payload = await fetchJson(`https://xaus.com/api/v1/spot?currency=INR&unit=gram&fresh=${Date.now()}`);
  const goldGram = num(payload?.xau?.price);
  const silverOz = num(payload?.silver_usd_oz);
  const fxRate = num(payload?.fx_rate);
  if (goldGram == null) throw new Error('XAUS returned no gold price');
  if (payload?.stale || payload?.data_state?.status === 'stale') {
    throw new Error('XAUS returned stale precious-metal data; refusing to publish stale values');
  }
  return {
    gold10g: goldGram * 10,
    silverKg: silverOz != null && fxRate != null ? silverOz * fxRate * 1000 / 31.1034768 : null,
    goldAsOf: payload?.price_as_of || payload?.updated_at || now,
    silverAsOf: payload?.updated_at || now,
    goldSource: `XAUS live XAU spot in INR · ${payload?.price_source || 'upstream'}`,
    silverSource: `XAUS live XAG spot converted to INR · ${payload?.silver_source || 'upstream'}`,
    stale: Boolean(payload?.stale || payload?.data_state?.status === 'stale')
  };
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
    source: 'NSE India public market feed'
  };
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
    source: 'BSE India public SENSEX feed'
  };
}

async function fetchSnapData() {
  const [india, crude] = await Promise.all([
    fetchJson('https://snapdata.dev/api/v1/equity-indices/in/latest.json'),
    fetchJson('https://snapdata.dev/api/v1/crude/world/latest.json')
  ]);
  return { india, crude };
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

function extractSnapObservation(payload, preferredName) {
  const observations = payload?.observations || payload?.data || [];
  const row = observations.find(x => String(x.name || x.series || x.id || '').toLowerCase().includes(preferredName.toLowerCase())) || observations[0];
  if (!row) return null;
  return {
    value: num(row.value ?? row.price ?? row.close),
    asOf: row.date || row.timestamp || payload?.updated_at || now,
    source: 'Snapdata daily fallback'
  };
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
  if (s === 'open') return 'Open';
  if (s === 'closed' || s === 'listed') return s === 'listed' ? 'Listed' : 'Closed';
  const today = new Date().toISOString().slice(0, 10);
  if (openDate && openDate <= today && (!closeDate || closeDate >= today)) return 'Open';
  return 'Upcoming';
}

function normalizeIpoGuru(raw) {
  const company = raw.name || raw.company || raw.companyName || raw.symbol || 'IPO';
  const boardText = String(raw.type || raw.board || '').toLowerCase();
  const board = boardText.includes('sme') ? 'SME' : 'Mainboard';
  const band = parseBand(raw.price_band ?? raw.priceBand ?? raw.issue_price);
  const lot = num(raw.lot_size ?? raw.lotSize);
  const openDate = toISO(raw.open_date ?? raw.openDate);
  const closeDate = toISO(raw.close_date ?? raw.closeDate);
  const status = ipoStatus(openDate, closeDate, raw.status);
  const issueText = String(raw.issue_size ?? raw.issueSize ?? '');
  const issueSizeCr = num(issueText.replace(/₹/g, '').replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);
  const sub = raw.subscription || {};
  const g = raw.gmp || {};
  return {
    slug: slugify(company),
    symbol: raw.symbol || null,
    name: company,
    type: board,
    status,
    exchange: raw.listing_on || raw.listingOn || (board === 'SME' ? 'NSE/BSE SME' : 'NSE/BSE'),
    band: band.min != null ? `₹${band.min.toLocaleString('en-IN')} – ₹${band.max.toLocaleString('en-IN')}` : (raw.price_band || '—'),
    priceBand: band,
    lot: lot || 0,
    lotSize: lot || 0,
    min: band.max != null && lot ? band.max * lot : null,
    issue: raw.issue_size || '—',
    issueSizeCr,
    open: openDate || '—',
    close: closeDate || '—',
    openDate,
    closeDate,
    allotment: toISO(raw.allotment_date ?? raw.allotmentDate),
    listing: toISO(raw.listing_date ?? raw.listingDate),
    listingDate: toISO(raw.listing_date ?? raw.listingDate),
    listingPrice: num(raw.listing_price),
    refund: null,
    credit: null,
    faceValue: raw.face_value ?? raw.faceValue ?? null,
    registrar: raw.registrar || null,
    leadManagers: raw.lead_managers || raw.leadManagers || null,
    fresh: raw.fresh_issue ?? raw.freshIssue ?? null,
    ofs: raw.ofs ?? null,
    saleType: raw.sale_type || null,
    sector: raw.industry || raw.sector || '—',
    objects: raw.objects || null,
    revenue: null,
    profit: null,
    debt: null,
    promoters: null,
    subscription: num(sub.total) ?? null,
    qib: num(sub.qib),
    nii: num(sub.nii),
    retail: num(sub.retail),
    subscriptionUpdated: sub.updated_at || null,
    gmp: num(g.price),
    gmpPct: num(g.percentage),
    gmpUpdated: g.updated_at || null,
    gmpSource: g.price != null ? 'IPO Guru API — unofficial/market-reported' : null,
    source: 'IPO Guru API',
    sourceDate: now.slice(0, 10),
    asOf: g.updated_at || sub.updated_at || now
  };
}

async function fetchIpoGuru() {
  const key = process.env.IPOGURU_API_KEY;
  if (!key) throw new Error('IPOGURU_API_KEY is not configured. Request the free IPO Guru key and add it to GitHub Actions Secrets.');
  // One request returns all active IPOs. This is important because the free plan
  // allows 300 requests/day; a 10-minute refresh cadence is 144 runs/day.
  const payload = await fetchJson('https://www.ipoguru.in/api/v1/ipos', { headers: { 'X-API-KEY': key } });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  if (!rows.length) throw new Error('IPO Guru returned zero IPO records');
  const map = new Map();
  for (const raw of rows) {
    const item = normalizeIpoGuru(raw);
    const keySlug = item.slug;
    const existing = map.get(keySlug);
    if (!existing || item.status === 'Open') map.set(keySlug, item);
  }
  const values = [...map.values()];
  return {
    mainboard: values.filter(x => x.type === 'Mainboard'),
    sme: values.filter(x => x.type === 'SME')
  };
}

function baseIpo(raw, status) {
  const company = raw.companyName || raw.company || raw.name || raw.symbol || 'IPO';
  const board = String(raw.series || raw.board || '').toUpperCase() === 'SME' || raw.isSme === true || raw.is_sme === true ? 'SME' : 'Mainboard';
  const band = parseBand(raw.issuePrice ?? raw.priceBand ?? `${raw.minPrice ?? ''}-${raw.maxPrice ?? ''}`);
  const lot = num(raw.lotSize ?? raw.lot_size ?? raw.minBidQuantity ?? raw.min_bid_quantity);
  const issueSizeCr = num(raw.issueSize ?? raw.issue_size) != null ? num(raw.issueSize ?? raw.issue_size) : null;
  const openDate = toISO(raw.issueStartDate ?? raw.openDate ?? raw.bidding_start_date);
  const closeDate = toISO(raw.issueEndDate ?? raw.closeDate ?? raw.bidding_end_date);
  return {
    slug: slugify(company), symbol: raw.symbol || null, name: company, type: board,
    status: ipoStatus(openDate, closeDate, status), exchange: board === 'SME' ? 'NSE/BSE SME' : 'NSE/BSE',
    band: band.min != null ? `₹${band.min.toLocaleString('en-IN')} – ₹${band.max.toLocaleString('en-IN')}` : '—',
    priceBand: band, lot: lot || 0, lotSize: lot || 0,
    min: band.max != null && lot ? band.max * lot : null,
    issue: issueSizeCr != null ? `₹${issueSizeCr.toLocaleString('en-IN')} Cr` : '—',
    issueSizeCr,
    open: openDate || '—', close: closeDate || '—', openDate, closeDate,
    allotment: toISO(raw.allotmentDate ?? raw.allotment_date), listing: toISO(raw.listingDate ?? raw.listing_date), listingDate: toISO(raw.listingDate ?? raw.listing_date),
    refund: null, credit: null, faceValue: raw.faceValue || raw.face_value || null,
    registrar: raw.registrar || null, leadManagers: raw.leadManagers || null,
    fresh: raw.freshIssue || raw.fresh_issue || null, ofs: raw.ofs || raw.offerForSale || null,
    sector: raw.industry || raw.sector || '—', objects: raw.objects || null,
    revenue: null, profit: null, debt: null, promoters: null,
    subscription: num(raw.noOfTimesSubscribed ?? raw.subscription) != null ? num(raw.noOfTimesSubscribed ?? raw.subscription) : null,
    qib: null, nii: null, retail: null, gmp: null, gmpUpdated: null,
    source: 'NSE India public IPO feed', sourceDate: now.slice(0, 10), asOf: now
  };
}

async function fetchNseIpos(cookie) {
  if (!cookie) throw new Error('NSE session unavailable for IPO feed');
  const [currentPayload, upcomingPayload] = await Promise.all([
    nseGet('/api/ipo-current-issue', cookie),
    nseGet('/api/all-upcoming-issues?category=ipo', cookie)
  ]);
  const current = unwrapRows(currentPayload);
  const upcoming = unwrapRows(upcomingPayload);
  const map = new Map();
  for (const raw of [...upcoming, ...current]) {
    const item = baseIpo(raw);
    if (!map.has(item.slug) || item.status === 'Open') map.set(item.slug, item);
  }
  return { mainboard: [...map.values()].filter(x => x.type === 'Mainboard'), sme: [...map.values()].filter(x => x.type === 'SME') };
}

function mergeIpos(primary, fallback) {
  const map = new Map(fallback.map(x => [x.slug, x]));
  for (const x of primary) map.set(x.slug, { ...map.get(x.slug), ...x });
  return [...map.values()];
}

async function writeDataset(result) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
}

const errors = [];

try {
  // Indian exchange data is fetched from the exchanges first. Yahoo is a fallback
  // for the Indian indices/GIFT and the primary source for global markets/commodities.
  const [nseMarket, bseSensex, yahoo, giftNifty, tvMarket, snap, metals, xaus, fx, fiiDii, news] = await Promise.allSettled([
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
    fetchSnapData(), fetchGoldApi(), fetchXausMetals(), fetchFx(), Promise.resolve(null), fetchNews()
  ]);

  const yahooGood = yahoo.status === 'fulfilled' ? yahoo.value.good : [];
  const yahooErrors = yahoo.status === 'fulfilled' ? yahoo.value.errors : [yahoo.reason?.message || String(yahoo.reason)];
  errors.push(...yahooErrors.map(e => `Yahoo: ${e}`));
  const byName = new Map(yahooGood.map(x => [x.name, x]));

  let nse = null;
  if (nseMarket.status === 'fulfilled') nse = nseMarket.value;
  else errors.push(`NSE market: ${nseMarket.reason?.message || nseMarket.reason}`);
  if (bseSensex.status === 'rejected') errors.push(`BSE SENSEX: ${bseSensex.reason?.message || bseSensex.reason}`);
  if (snap.status === 'rejected') errors.push(`Snapdata: ${snap.reason?.message || snap.reason}`);
  if (metals.status === 'rejected') errors.push(`Gold API: ${metals.reason?.message || metals.reason}`);
  if (fx.status === 'rejected') errors.push(`FX: ${fx.reason?.message || fx.reason}`);
  if (news.status === 'rejected') errors.push(`News: ${news.reason?.message || news.reason}`);
  if (giftNifty.status === 'rejected') errors.push(`GIFT Nifty: ${giftNifty.reason?.message || giftNifty.reason}`);
  if (tvMarket.status === 'rejected') errors.push(`TradingView market: ${tvMarket.reason?.message || tvMarket.reason}`);
  if (xaus.status === 'rejected') errors.push(`XAUS metals: ${xaus.reason?.message || xaus.reason}`);

  const snapIndia = snap.status === 'fulfilled' ? snap.value.india : null;
  const snapNifty = extractSnapObservation(snapIndia, 'nifty 50');
  const snapBank = extractSnapObservation(snapIndia, 'nifty bank');

  const nseByName = new Map((nse?.indices || []).map(x => [x.name, x]));
  const fallback = (name, snapRow) => snapRow ? { name, value: snapRow.value, change: null, pct: null, kind: 'index', asOf: snapRow.asOf, source: snapRow.source } : null;
  const indices = [
    nseByName.get('NIFTY 50') || byName.get('NIFTY 50') || fallback('NIFTY 50', snapNifty),
    bseSensex.status === 'fulfilled' ? bseSensex.value : (byName.get('SENSEX') || null),
    nseByName.get('BANK NIFTY') || byName.get('BANK NIFTY') || fallback('BANK NIFTY', snapBank),
    giftNifty.status === 'fulfilled' ? giftNifty.value : (byName.get('GIFT NIFTY') || null)
  ].filter(Boolean);

  const tvGood = tvMarket.status === 'fulfilled' ? tvMarket.value : [];
  const tvByName = new Map(tvGood.map(x => [x.name, x]));
  // Use one provider family for global indices/FX/energy so values are not mixed
  // across timestamps. TradingView is only a fallback here.
  const global = ['S&P 500','NASDAQ 100','FTSE 100','HANG SENG'].map(n => byName.get(n) || tvByName.get(n)).filter(Boolean);
  const usdInr = byName.get('USD/INR') || tvByName.get('USD/INR');
  const fxRate = usdInr?.value ?? (fx.status === 'fulfilled' ? num(fx.value?.rates?.INR) : null);
  let xausMetals = xaus.status === 'fulfilled' ? xaus.value : null;
  const commodities = [];
  if (usdInr) commodities.push({ name: 'USD/INR', ...usdInr, unit: '₹', source: usdInr.source });
  if (xausMetals?.gold10g != null) commodities.push({ name: 'GOLD', value: xausMetals.gold10g, change: null, pct: null, unit: '₹/10g', asOf: xausMetals.goldAsOf, source: xausMetals.goldSource, note: null });
  if (xausMetals?.silverKg != null) commodities.push({ name: 'SILVER', value: xausMetals.silverKg, change: null, pct: null, unit: '₹/kg', asOf: xausMetals.silverAsOf, source: xausMetals.silverSource, note: null });
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

  let ipoBase = { mainboard: [], sme: [] };
  let ipoGuruError = null;
  try {
    ipoBase = await fetchIpoGuru();
  } catch (e) {
    ipoGuruError = e;
    errors.push(`IPO Guru: ${e.message}`);
    try {
      let cookie = nse?.cookie;
      if (!cookie) cookie = await createNseSession();
      ipoBase = await fetchNseIpos(cookie);
    } catch (fallbackError) {
      errors.push(`NSE IPO fallback: ${fallbackError.message}`);
    }
  }

  const mainboard = ipoBase.mainboard || [];
  const sme = ipoBase.sme || [];

  const result = {
    updatedAt: now,
    refreshWindow: '10 minutes',
    timezone: 'Asia/Kolkata',
    source: 'Exchange-first free shared feed — NSE/BSE + TradingView/Gold-API/Yahoo fallbacks',
    refresh: { status: 'ok', updatedAt: now, cadence: '10 minutes', partial: errors.length > 0, errors },
    dataPolicy: {
      primary: 'API-only', noSnapshotFallback: true, noPerVisitorProviderCalls: true,
      replaceOldDataOnSuccessfulRefresh: true, refreshCadence: '10 minutes',
      indianEquitiesPrimary: 'NSE/BSE public exchange feeds', giftNiftyPrimary: 'TradingView public scanner · NSE International Exchange', globalPrimary: 'Yahoo Finance public chart feed; TradingView fallback'
    },
    market: { indices, global, commodities, stocks },
    fiiDii: fii,
    ipo: { mainboard, sme },
    news: news.status === 'fulfilled' ? news.value : []
  };

  const minimum = result.market.indices.length >= 3 && result.market.global.length >= 2 && result.market.commodities.length >= 4;
  if (!minimum) throw new Error(`Refresh incomplete: ${result.market.indices.length} Indian indices, ${result.market.global.length} global indices and ${result.market.commodities.length} commodities available.`);
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
