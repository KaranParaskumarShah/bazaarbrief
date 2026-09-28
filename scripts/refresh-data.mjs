import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const out = path.join(root, 'public', 'data', 'latest.json');
const now = new Date().toISOString();

async function getJson(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'BazaarBriefDataRefresh/2.1', ...(options.headers || {}) }
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.json();
}

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
function required(name, value) { if (!value) throw new Error(`Missing required configuration: ${name}`); }
function pct(value, prev) { return value != null && prev ? ((value - prev) / prev) * 100 : null; }
function change(value, prev) { return value != null && prev != null ? value - prev : null; }
function quote(symbol, q, kind = 'market') {
  const value = n(q?.close ?? q?.price ?? q?.value);
  if (value == null) throw new Error(`Provider returned no price for ${symbol}`);
  const prev = n(q?.previous_close ?? q?.previousClose ?? q?.prev_close);
  return {
    value,
    change: change(value, prev),
    pct: n(q?.percent_change ?? q?.percentChange) ?? pct(value, prev),
    kind,
    asOf: q?.datetime || q?.timestamp || now,
    source: 'Twelve Data API',
    providerSymbol: q?.symbol || symbol
  };
}

function indexQuote(name, symbol, raw, kind='index') {
  const key = Object.keys(raw || {}).find(k => String(k).toUpperCase() === String(symbol).toUpperCase());
  const q = raw?.[key] ?? (Array.isArray(raw) ? raw.find(x => String(x?.symbol).toUpperCase() === String(symbol).toUpperCase()) : null);
  if (!q || q.status === 'error') throw new Error(`No valid quote returned for ${name} (${symbol})`);
  return { name, ...quote(symbol, q, kind) };
}

async function twelveBatch(symbolMap) {
  required('TWELVE_DATA_KEY', process.env.TWELVE_DATA_KEY);
  const entries = Object.entries(symbolMap).filter(([, symbol]) => symbol);
  required('At least one Twelve Data symbol', entries.length);
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(entries.map(([,s]) => s).join(','))}&apikey=${encodeURIComponent(process.env.TWELVE_DATA_KEY)}`;
  const raw = await getJson(url);
  const normalized = {};
  for (const [name, symbol] of entries) {
    normalized[name] = indexQuote(name, symbol, raw, 'market');
  }
  return normalized;
}

async function normalizedFeed(envName) {
  const url = process.env[envName];
  required(envName, url);
  const payload = await getJson(url);
  if (!payload || typeof payload !== 'object') throw new Error(`${envName} did not return JSON object`);
  return payload;
}

const symbols = {
  'NIFTY 50': process.env.NIFTY_SYMBOL || 'NSE:NIFTY',
  'SENSEX': process.env.SENSEX_SYMBOL || 'BSE:SENSEX',
  'BANK NIFTY': process.env.BANK_NIFTY_SYMBOL || 'NSE:BANKNIFTY',
  'GIFT NIFTY': process.env.GIFT_NIFTY_SYMBOL,
  'S&P 500': process.env.SP500_SYMBOL || 'SPX',
  'NASDAQ 100': process.env.NASDAQ_SYMBOL || 'NDX',
  'FTSE 100': process.env.FTSE_SYMBOL || 'FTSE',
  'HANG SENG': process.env.HANGSENG_SYMBOL || 'HSI',
  'USD/INR': process.env.USDINR_SYMBOL || 'USD/INR',
  'GOLD USD': process.env.GOLD_SPOT_SYMBOL || 'XAU/USD',
  'SILVER USD': process.env.SILVER_SPOT_SYMBOL || 'XAG/USD',
  'BRENT': process.env.BRENT_SYMBOL || 'XBR/USD',
  'WTI': process.env.WTI_SYMBOL || 'WTI/USD',
  'NATURAL GAS': process.env.NATURAL_GAS_SYMBOL || 'XNG/USD'
};

const quotes = await twelveBatch(symbols);

// Gold/Silver can be supplied as direct Indian INR API feeds. If not configured,
// convert the live USD spot API quote using the same live USD/INR API quote.
const usdInr = quotes['USD/INR'].value;
const goldUsd = quotes['GOLD USD'];
const silverUsd = quotes['SILVER USD'];
const goldDirect = process.env.GOLD_INR_URL ? await normalizedFeed('GOLD_INR_URL') : null;
const silverDirect = process.env.SILVER_INR_URL ? await normalizedFeed('SILVER_INR_URL') : null;

function directMetal(payload, fallback, unit, factor) {
  if (!payload) return { ...fallback, value: fallback.value * factor, displayValue: fallback.value * factor, displayUnit: unit, conversion: 'live USD spot × live USD/INR', source: 'Twelve Data API' };
  const value = n(payload.value ?? payload.price ?? payload.close);
  if (value == null) throw new Error('Direct metal API returned no numeric value');
  return { value, change: n(payload.change), pct: n(payload.pct ?? payload.percent_change), displayValue: value, displayUnit: unit, asOf: payload.asOf || payload.datetime || now, source: payload.source || 'Direct INR commodity API', conversion: 'direct INR API' };
}

const gold = directMetal(goldDirect, goldUsd, '₹/10g', usdInr * 10 / 31.1034768);
const silver = directMetal(silverDirect, silverUsd, '₹/kg', usdInr * 1000 / 31.1034768);

const ipo = await normalizedFeed('IPO_JSON_URL');
const gmp = await normalizedFeed('GMP_JSON_URL');
const fiiDii = await normalizedFeed('FIIDI_JSON_URL');
const stocks = await normalizedFeed('STOCKS_JSON_URL');
const news = await normalizedFeed('NEWS_JSON_URL');

if (!Array.isArray(ipo.mainboard) || !Array.isArray(ipo.sme)) throw new Error('IPO_JSON_URL must return {mainboard:[],sme:[]}');
if (!Array.isArray(stocks.stocks || stocks)) throw new Error('STOCKS_JSON_URL must return {stocks:[]} or an array');
if (!Array.isArray(news.news || news)) throw new Error('NEWS_JSON_URL must return {news:[]} or an array');
if (fiiDii.fii == null && fiiDii.dii == null && !fiiDii.fiiDii) throw new Error('FIIDI_JSON_URL must return FII/DII data');

const ipoRows = [...ipo.mainboard, ...ipo.sme];
const gmpRows = Array.isArray(gmp) ? gmp : (gmp.data || gmp.gmp || []);
const gmpMap = new Map(gmpRows.map(x => [String(x.slug || x.symbol || x.name).toLowerCase(), x]));
function applyGmp(list) {
  return list.map(row => {
    const patch = gmpMap.get(String(row.slug || row.symbol || row.name).toLowerCase());
    return patch ? { ...row, ...patch, gmpSource: patch.gmpSource || patch.source || 'Unofficial / market-reported API', gmpUpdated: patch.gmpUpdated || patch.asOf || now } : row;
  });
}

const result = {
  updatedAt: now,
  source: 'API-only shared scheduled feed',
  refresh: { status: 'ok', updatedAt: now, cadence: '2 hours', partial: false, errors: [] },
  dataPolicy: {
    primary: 'API-only',
    noSnapshotFallback: true,
    noPerVisitorProviderCalls: true,
    replaceOldDataOnSuccessfulRefresh: true,
    refreshCadence: '2 hours'
  },
  market: {
    indices: ['NIFTY 50','SENSEX','BANK NIFTY','GIFT NIFTY'].map(name => quotes[name]),
    global: ['S&P 500','NASDAQ 100','FTSE 100','HANG SENG'].map(name => quotes[name]),
    commodities: [
      { name:'USD/INR', ...quotes['USD/INR'], unit:'₹' },
      { name:'GOLD', ...gold, unit:'₹/10g' },
      { name:'SILVER', ...silver, unit:'₹/kg' },
      { name:'BRENT', ...quotes['BRENT'], unit:'$/bbl' },
      { name:'WTI', ...quotes['WTI'], unit:'$/bbl' },
      { name:'NATURAL GAS', ...quotes['NATURAL GAS'], unit:'$/MMBtu' }
    ],
    stocks: stocks.stocks || stocks
  },
  fiiDii: fiiDii.fiiDii || { ...fiiDii, source: fiiDii.source || 'FII/DII API' },
  ipo: { mainboard: applyGmp(ipo.mainboard), sme: applyGmp(ipo.sme) },
  news: news.news || news
};

await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote API-only dataset: ${out}`);
console.log(JSON.stringify({ updatedAt: now, indices: result.market.indices.length, global: result.market.global.length, commodities: result.market.commodities.length, mainboard: result.ipo.mainboard.length, sme: result.ipo.sme.length }, null, 2));
