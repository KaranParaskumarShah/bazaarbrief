import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('public/data/latest.json');
const now = new Date().toISOString();

async function fetchJson(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': 'BazaarBrief/3.0 (+https://bazaarbrief.in)',
      ...(options.headers || {})
    }
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.json();
}

async function fetchText(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      Accept: 'text/html,text/plain,application/rss+xml,application/xml,*/*',
      'User-Agent': 'BazaarBrief/3.0 (+https://bazaarbrief.in)',
      ...(options.headers || {})
    }
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.text();
}

const num = v => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const changePct = (value, previous) => value != null && previous ? ((value - previous) / previous) * 100 : null;
const changePts = (value, previous) => value != null && previous != null ? value - previous : null;

function yahooSymbolResult(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo returned no chart result for ${symbol}`);
  const meta = result.meta || {};
  const value = num(meta.regularMarketPrice ?? meta.previousClose);
  if (value == null) throw new Error(`Yahoo returned no price for ${symbol}`);
  const previous = num(meta.previousClose);
  return {
    value,
    change: changePts(value, previous),
    pct: changePct(value, previous),
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : now,
    currency: meta.currency || null,
    providerSymbol: symbol,
    source: 'Yahoo Finance public chart feed'
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
    source: 'Snapdata'
  };
}

async function fetchFiiDii() {
  // NSE's public endpoint. We prime the session first because NSE's edge protection
  // commonly rejects a cold request without the home-page cookies.
  const home = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BazaarBrief/3.0)', Accept: 'text/html' }
  });
  const cookie = home.headers.get('set-cookie') || '';
  const r = await fetch('https://www.nseindia.com/api/fiidiiTradeReact', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BazaarBrief/3.0)',
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://www.nseindia.com/',
      Cookie: cookie
    }
  });
  if (!r.ok) throw new Error(`NSE FII/DII HTTP ${r.status}`);
  const rows = await r.json();
  const list = Array.isArray(rows) ? rows : [];
  const fii = list.find(x => /FII|FPI/i.test(String(x.category || x.clientType || x.type || '')));
  const dii = list.find(x => /DII/i.test(String(x.category || x.clientType || x.type || '')));
  const readNet = x => num(x?.netValue ?? x?.net ?? x?.netValueInCr ?? x?.netValueCr);
  if (!fii && !dii) throw new Error('NSE FII/DII response did not contain recognised categories');
  return {
    fii: readNet(fii),
    dii: readNet(dii),
    date: fii?.date || dii?.date || new Date().toISOString().slice(0, 10),
    source: 'NSE public FII/DII endpoint',
    asOf: now
  };
}

async function fetchIndianStocks() {
  // Free, no-key community API. Batch the movers universe into one request.
  // This provider itself is an adapter over public market data; do not call it from browsers.
  const symbols = [
    'RELIANCE.NS','HDFCBANK.NS','ICICIBANK.NS','INFY.NS','TCS.NS','SBIN.NS','BHARTIARTL.NS','ITC.NS',
    'LT.NS','AXISBANK.NS','KOTAKBANK.NS','HINDUNILVR.NS','MARUTI.NS','SUNPHARMA.NS','TITAN.NS','M&M.NS',
    'BAJFINANCE.NS','ADANIENT.NS','NTPC.NS','POWERGRID.NS','TATAMOTORS.NS','TRENT.NS','BEL.NS','DRREDDY.NS',
    'HCLTECH.NS','TECHM.NS','WIPRO.NS','ONGC.NS','COALINDIA.NS','ADANIPORTS.NS','HINDALCO.NS','JSWSTEEL.NS'
  ];
  const url = `http://65.0.104.9/stock/list?symbols=${encodeURIComponent(symbols.join(','))}&res=num`;
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload) ? payload : (payload.stocks || payload.data || []);
  if (!rows.length) throw new Error('Indian stock free API returned no rows');
  return rows.map(x => ({
    symbol: String(x.symbol || x.ticker || '').replace(/\.NS$/i, ''),
    name: x.name || x.companyName || x.symbol,
    price: num(x.price ?? x.currentPrice ?? x.lastPrice ?? x.ltp),
    pct: num(x.changePercent ?? x.pctChange ?? x.percentChange ?? x.pct),
    change: num(x.change ?? x.changeValue),
    source: 'Indian Stock Market API',
    asOf: x.asOf || x.timestamp || now
  })).filter(x => x.symbol && x.price != null);
}

function parseRss(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);
  return items.map((m, i) => {
    const block = m[1];
    const pick = tag => {
      const hit = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return hit ? hit[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
    };
    return {
      tag: 'MARKET NEWS',
      title: pick('title'),
      source: 'Google News RSS',
      age: pick('pubDate'),
      url: pick('link')
    };
  }).filter(x => x.title);
}

async function fetchNews() {
  const xml = await fetchText('https://news.google.com/rss/search?q=Indian%20stock%20market%20Nifty%20Sensex%20IPO&hl=en-IN&gl=IN&ceid=IN:en');
  return parseRss(xml);
}

async function fetchIpo() {
  // Free no-key basic Indian IPO feed. Enhanced GMP/subscription data can be layered
  // in via IPO_GURU_API_KEY when available; the base feed is still entirely dynamic.
  const payload = await fetchJson('https://analyst.indianapi.in/ipo');
  const normalize = (rows, type) => (Array.isArray(rows) ? rows : []).map(x => ({
    slug: x.slug || x.symbol || String(x.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    symbol: x.symbol || null,
    name: x.name || x.company || x.symbol,
    status: x.status || type,
    type: x.is_sme ? 'SME' : 'Mainboard',
    exchange: x.exchange || null,
    priceBand: x.price_band || x.priceBand || null,
    lotSize: num(x.lot_size ?? x.lotSize),
    issueSize: x.issue_size || x.issueSize || null,
    openDate: x.open_date || x.openDate || null,
    closeDate: x.close_date || x.closeDate || null,
    allotmentDate: x.allotment_date || x.allotmentDate || null,
    listingDate: x.listing_date || x.listingDate || null,
    registrar: x.registrar || null,
    source: 'IndianAPI IPO feed',
    asOf: now
  }));
  const mainboard = normalize(payload.open, 'open').filter(x => x.type !== 'SME');
  const sme = normalize(payload.open, 'open').filter(x => x.type === 'SME');
  return { mainboard, sme };
}

async function fetchGmp(ipo) {
  const key = process.env.IPOGURU_API_KEY;
  if (!key) return { rows: [], warning: 'GMP API key not configured. IPO structure is dynamic; GMP requires a free IPO Guru API key.' };
  const payload = await fetchJson('https://www.ipoguru.in/api/v1/ipos?status=open', { headers: { 'X-API-KEY': key } });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return {
    rows: rows.map(x => ({
      slug: x.slug || x.symbol || String(x.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      gmp: num(x.gmp?.price ?? x.gmp),
      gmpPct: num(x.gmp?.percentage),
      gmpUpdated: x.gmp?.updated_at || now,
      subscription: x.subscription || null,
      gmpSource: 'IPO Guru API — unofficial/market-reported',
      asOf: now
    })),
    warning: null
  };
}

function mergeGmp(list, gmpRows) {
  const map = new Map(gmpRows.map(x => [String(x.slug).toLowerCase(), x]));
  return list.map(x => {
    const p = map.get(String(x.slug).toLowerCase());
    return p ? { ...x, ...p } : x;
  });
}

async function writeDataset(result) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
}

const errors = [];

try {
  const [yahoo, snap, metals, fx, fiiDii, stocks, news, ipo] = await Promise.allSettled([
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
    fetchSnapData(), fetchGoldApi(), fetchFx(), fetchFiiDii(), fetchIndianStocks(), fetchNews(), fetchIpo()
  ]);

  const y = yahoo.status === 'fulfilled' ? yahoo.value.good : [];
  if (yahoo.status === 'rejected') errors.push(`Yahoo feed: ${yahoo.reason?.message || yahoo.reason}`);
  const byName = new Map(y.map(x => [x.name, x]));

  let snapIndia = null;
  let snapCrude = null;
  if (snap.status === 'fulfilled') {
    snapIndia = snap.value.india;
    snapCrude = snap.value.crude;
  } else errors.push(`Snapdata: ${snap.reason?.message || snap.reason}`);

  if (metals.status === 'rejected') errors.push(`Gold API: ${metals.reason?.message || metals.reason}`);
  if (fx.status === 'rejected') errors.push(`FX: ${fx.reason?.message || fx.reason}`);
  if (fiiDii.status === 'rejected') errors.push(`FII/DII: ${fiiDii.reason?.message || fiiDii.reason}`);
  if (stocks.status === 'rejected') errors.push(`Stocks: ${stocks.reason?.message || stocks.reason}`);
  if (news.status === 'rejected') errors.push(`News: ${news.reason?.message || news.reason}`);
  if (ipo.status === 'rejected') errors.push(`IPO: ${ipo.reason?.message || ipo.reason}`);

  // Snapdata is only used as a provider fallback for Indian indices if Yahoo misses one.
  const snapNifty = extractSnapObservation(snapIndia, 'nifty 50');
  const snapBank = extractSnapObservation(snapIndia, 'nifty bank');
  const snapSensex = extractSnapObservation(snapIndia, 'sensex');

  function indexFallback(name, snapRow) {
    if (!snapRow) return null;
    return { name, value: snapRow.value, change: null, pct: null, kind: 'index', asOf: snapRow.asOf, source: snapRow.source, providerSymbol: null };
  }

  const indices = [
    byName.get('NIFTY 50') || indexFallback('NIFTY 50', snapNifty),
    byName.get('SENSEX') || indexFallback('SENSEX', snapSensex),
    byName.get('BANK NIFTY') || indexFallback('BANK NIFTY', snapBank),
    byName.get('GIFT NIFTY')
  ].filter(Boolean);

  const global = ['S&P 500','NASDAQ 100','FTSE 100','HANG SENG'].map(n => byName.get(n)).filter(Boolean);

  const usdInr = byName.get('USD/INR');
  const fxRate = fx.status === 'fulfilled' ? num(fx.value?.rates?.INR) : usdInr?.value;
  const gold = metals.status === 'fulfilled' ? num(metals.value.gold?.price) : null;
  const silver = metals.status === 'fulfilled' ? num(metals.value.silver?.price) : null;
  const goldInr = metalInr(gold, fxRate, '₹/10g');
  const silverInr = metalInr(silver, fxRate, '₹/kg');

  const commodities = [];
  if (usdInr) commodities.push({ name: 'USD/INR', ...usdInr, unit: '₹' });
  if (goldInr != null) commodities.push({ name: 'GOLD', value: goldInr, change: null, pct: null, unit: '₹/10g', asOf: metals.value.gold.updatedAt || now, source: 'Gold-API live spot × live FX' });
  if (silverInr != null) commodities.push({ name: 'SILVER', value: silverInr, change: null, pct: null, unit: '₹/kg', asOf: metals.value.silver.updatedAt || now, source: 'Gold-API live spot × live FX' });
  for (const name of ['BRENT','WTI','NATURAL GAS']) {
    const q = byName.get(name);
    if (q) commodities.push({ name, ...q, unit: name === 'NATURAL GAS' ? '$/MMBtu' : '$/bbl' });
  }

  const ipoBase = ipo.status === 'fulfilled' ? ipo.value : { mainboard: [], sme: [] };
  const gmp = await fetchGmp(ipoBase).catch(e => ({ rows: [], warning: e.message }));
  if (gmp.warning) errors.push(gmp.warning);
  const mainboard = mergeGmp(ipoBase.mainboard, gmp.rows);
  const sme = mergeGmp(ipoBase.sme, gmp.rows);

  const result = {
    updatedAt: now,
    source: 'Free live API aggregation — shared scheduled feed',
    refresh: { status: 'ok', updatedAt: now, cadence: '2 hours', partial: errors.length > 0, errors },
    dataPolicy: {
      primary: 'API-only',
      noSnapshotFallback: true,
      noPerVisitorProviderCalls: true,
      replaceOldDataOnSuccessfulRefresh: true,
      refreshCadence: '2 hours'
    },
    market: {
      indices,
      global,
      commodities,
      stocks: stocks.status === 'fulfilled' ? stocks.value : []
    },
    fiiDii: fiiDii.status === 'fulfilled' ? fiiDii.value : {},
    ipo: { mainboard, sme },
    news: news.status === 'fulfilled' ? news.value : []
  };

  const minimum = result.market.indices.length >= 3 && result.market.global.length >= 2 && result.market.commodities.length >= 4;
  if (!minimum) throw new Error(`Refresh incomplete: only ${result.market.indices.length} Indian indices, ${result.market.global.length} global indices and ${result.market.commodities.length} commodities were fetched.`);
  await writeDataset(result);
  console.log(JSON.stringify({ ok: true, updatedAt: now, errors, indices: result.market.indices.length, global: result.market.global.length, commodities: result.market.commodities.length, stocks: result.market.stocks.length, mainboard: mainboard.length, sme: sme.length, news: result.news.length }, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
}
