import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const out = path.join(root, 'public', 'data', 'latest.json');
const previous = JSON.parse(await fs.readFile(out, 'utf8'));
const now = new Date().toISOString();

async function getJson(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { 'User-Agent': 'BazaarBriefDataRefresh/1.0', ...(options.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function quoteRow(q, old) {
  if (!q || q.status === 'error' || q.close == null) return old;
  const value = num(q.close); const prev = num(q.previous_close ?? q.previousClose);
  return { ...old, value, change: prev == null ? old.change : value - prev, pct: prev ? ((value - prev) / prev) * 100 : old.pct, asOf: q.datetime || q.last_quote_at || now };
}

const next = structuredClone(previous);
next.updatedAt = now;
next.source = 'Shared data cache · scheduled refresh';
next.refresh = { status: 'ok', updatedAt: now, cadence: '2 hours' };
const errors = [];

// One batched Twelve Data quote request for all configured market/commodity/FX symbols.
if (process.env.TWELVE_DATA_KEY) {
  const symbols = {
    'NIFTY 50': process.env.NIFTY_SYMBOL || 'NSE:NIFTY',
    'SENSEX': process.env.SENSEX_SYMBOL || 'BSE:SENSEX',
    'BANK NIFTY': process.env.BANK_NIFTY_SYMBOL || 'NSE:BANKNIFTY',
    'GIFT NIFTY': process.env.GIFT_NIFTY_SYMBOL || '',
    'S&P 500': process.env.SP500_SYMBOL || 'SPX',
    'NASDAQ 100': process.env.NASDAQ_SYMBOL || 'NDX',
    'FTSE 100': process.env.FTSE_SYMBOL || 'FTSE',
    'HANG SENG': process.env.HANGSENG_SYMBOL || 'HSI',
    'USD/INR': process.env.USDINR_SYMBOL || 'USD/INR',
    'GOLD SPOT': process.env.GOLD_SYMBOL || 'XAU/USD',
    'BRENT': process.env.BRENT_SYMBOL || 'BRENT/USD',
    'WTI': process.env.WTI_SYMBOL || 'WTI/USD'
  };
  const usable = Object.entries(symbols).filter(([, s]) => s);
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(usable.map(([,s])=>s).join(','))}&apikey=${encodeURIComponent(process.env.TWELVE_DATA_KEY)}`;
    const raw = await getJson(url);
    const rows = Array.isArray(raw) ? raw : Object.values(raw || {});
    const bySymbol = new Map(rows.filter(x=>x?.symbol).map(x=>[String(x.symbol).toUpperCase(),x]));
    const find = name => bySymbol.get(String(symbols[name]).toUpperCase());
    const indexNames = ['NIFTY 50','SENSEX','BANK NIFTY','GIFT NIFTY'];
    next.market.indices = next.market.indices.map(item => find(item.name) ? quoteRow(find(item.name), item) : item);
    next.market.global = next.market.global.map(item => find(item.name) ? quoteRow(find(item.name), item) : item);
    next.market.commodities = next.market.commodities.map(item => find(item.name) ? ({...item, value:num(find(item.name).close) ?? item.value, pct:num(find(item.name).percent_change) ?? item.pct, asOf:find(item.name).datetime || now}) : item);
  } catch (e) { errors.push(`Twelve Data: ${e.message}`); }
} else errors.push('TWELVE_DATA_KEY is not configured');

// Optional normalized feeds. Each feed returns the corresponding object/array already normalized for the UI.
const feeds = [
  ['IPO_JSON_URL', async j => { if (j?.mainboard || j?.sme) next.ipo = { ...next.ipo, ...j }; }],
  ['GMP_JSON_URL', async j => {
    const all = [...(next.ipo.mainboard||[]), ...(next.ipo.sme||[])];
    const incoming = Array.isArray(j) ? j : (j?.data || []);
    const map = new Map(incoming.map(x=>[String(x.slug || x.symbol || x.name).toLowerCase(),x]));
    const patch = list => list.map(x => { const y = map.get(String(x.slug || x.symbol || x.name).toLowerCase()); return y ? {...x,...y,gmpSource:y.gmpSource || 'Unofficial / market-reported',gmpUpdated:y.gmpUpdated || now} : x; });
    next.ipo.mainboard = patch(next.ipo.mainboard); next.ipo.sme = patch(next.ipo.sme);
  }],
  ['FIIDI_JSON_URL', async j => { if (j?.fiiDii) next.fiiDii = j.fiiDii; else if (j?.fii != null || j?.dii != null) next.fiiDii = {...next.fiiDii,...j}; }],
  ['NEWS_JSON_URL', async j => { next.news = Array.isArray(j) ? j : (j?.news || next.news); }]
];
for (const [env, apply] of feeds) {
  if (!process.env[env]) continue;
  try { await apply(await getJson(process.env[env])); }
  catch (e) { errors.push(`${env}: ${e.message}`); }
}

next.refresh.errors = errors;
next.refresh.partial = errors.length > 0;
await fs.writeFile(out, JSON.stringify(next, null, 2) + '\n');
console.log(JSON.stringify({ updatedAt: now, errors }, null, 2));
