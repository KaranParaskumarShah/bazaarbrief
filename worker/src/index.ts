export interface Env {
  MARKET_CACHE?: KVNamespace;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGIN?: string;
  IPO_DATA_URL?: string;
  FII_DII_DATA_URL?: string;
  NEWS_RSS_URLS?: string;
  REFRESH_SECRET?: string;
  LOCAL_DEV?: string;
}

type Dataset = 'indices' | 'ipos' | 'news' | 'fii-dii' | 'history';
const CACHE_KEYS: Record<Dataset, string> = {
  indices: 'indices/latest', ipos: 'ipos/latest', news: 'news/latest',
  'fii-dii': 'fii-dii/latest', history: 'indices/history',
};
const SYMBOLS = [
  { symbol: '^NSEI', name: 'Nifty 50' },
  { symbol: '^BSESN', name: 'BSE Sensex' },
  { symbol: '^NSEBANK', name: 'Nifty Bank' },
  { symbol: '^INDIAVIX', name: 'India VIX' },
  { symbol: 'GC=F', name: 'Gold futures (USD/oz)' },
  { symbol: 'SI=F', name: 'Silver futures (USD/oz)' },
  { symbol: 'BZ=F', name: 'Brent crude (USD/bbl)' },
  { symbol: 'INR=X', name: 'USD / INR' },
];
const headers = (origin: string, env: Env) => {
  const allowed = (env.ALLOWED_ORIGIN || 'https://bazaarbrief.in').split(',').map(x => x.trim());
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const corsOrigin = allowed.includes('*') ? '*' : (allowed.includes(origin) || local ? origin : (allowed[0] || 'https://bazaarbrief.in'));
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'vary': 'Origin',
  };
};

const DATASET_TTL: Record<Dataset, number> = {
  indices: 60,
  ipos: 600,
  news: 300,
  'fii-dii': 1800,
  history: 60,
};

function edgeCache() {
  try { return typeof caches !== 'undefined' ? caches.default : undefined; }
  catch { return undefined; }
}
function edgeCacheKey(origin: string, dataset: Dataset) {
  return new Request(new URL(`/__bazaarbrief_cache/${dataset}`, origin).toString(), { method: 'GET' });
}
async function readDataset(dataset: Dataset, origin: string, env: Env): Promise<string | null> {
  if (env.MARKET_CACHE) {
    try {
      const raw = await env.MARKET_CACHE.get(CACHE_KEYS[dataset]);
      if (raw) return raw;
    } catch { /* Continue to edge cache and live upstreams if KV is not bound or unavailable. */ }
  }
  const cache = edgeCache();
  if (cache) {
    try {
      const cached = await cache.match(edgeCacheKey(origin, dataset));
      if (cached) return await cached.text();
    } catch { /* Cache miss is not fatal. */ }
  }
  return null;
}
async function writeDataset(dataset: Dataset, data: unknown, origin: string, env: Env): Promise<void> {
  const raw = JSON.stringify(data);
  if (env.MARKET_CACHE) {
    try { await env.MARKET_CACHE.put(CACHE_KEYS[dataset], raw, { expirationTtl: Math.max(DATASET_TTL[dataset] * 4, 3600) }); }
    catch { /* Edge cache still works if KV is not configured. */ }
  }
  const cache = edgeCache();
  if (cache) {
    try {
      await cache.put(edgeCacheKey(origin, dataset), new Response(raw, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, s-maxage=${DATASET_TTL[dataset]}` },
      }));
    } catch { /* The response can still be returned without caching. */ }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const h = headers(request.headers.get('Origin') || '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'bazaarbrief-data',
        mode: env.MARKET_CACHE ? 'live-cache+kv' : 'live-cache',
        kvEnabled: Boolean(env.MARKET_CACHE),
        cron: '*/15 * * * *',
        endpoints: ['/api/indices', '/api/history', '/api/ipos', '/api/news', '/api/fii-dii'],
      }, { headers: { ...h, 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/admin/refresh') {
      if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: h });
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      const isLocalRefresh = env.LOCAL_DEV === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!isLocalRefresh && (!env.REFRESH_SECRET || !token || token !== env.REFRESH_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: h });
      const report = await refreshAll(env, url.origin);
      return Response.json({ ok: Object.values(report).some(v => v.startsWith('updated')), refreshedAt: new Date().toISOString(), report }, { headers: { ...h, 'cache-control': 'no-store' } });
    }
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: h });
    const match = url.pathname.match(/^\/api\/(indices|ipos|news|fii-dii|history)$/);
    if (!match) return Response.json({ error: 'Not found', path: url.pathname }, { status: 404, headers: h });
    const dataset = match[1] as Dataset;
    const cached = await readDataset(dataset, url.origin, env);
    if (cached) return new Response(cached, { headers: { ...h, 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, stale-while-revalidate=300`, 'x-data-status': 'cached', 'x-dataset': dataset } });
    try {
      const data = await fetchDataset(dataset, env);
      if (!Array.isArray(data) || data.length === 0) throw new Error('The upstream provider returned no records');
      await writeDataset(dataset, data, url.origin, env);
      return Response.json(data, { headers: { ...h, 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, stale-while-revalidate=300`, 'x-data-status': 'live', 'x-dataset': dataset } });
    } catch (error) {
      return Response.json({
        error: 'Live dataset unavailable',
        dataset,
        detail: error instanceof Error ? error.message : 'Upstream request failed',
        source: null,
        updatedAt: null,
      }, { status: 503, headers: { ...h, 'cache-control': 'no-store', 'x-dataset': dataset } });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const origin = env.PUBLIC_ORIGIN || 'https://bazaarbrief.in';
    ctx.waitUntil(refreshAll(env, origin));
  },
};

async function fetchDataset(dataset: Dataset, env: Env): Promise<any[]> {
  if (dataset === 'indices') {
    const results = await Promise.allSettled(SYMBOLS.map(s => yahooChart(s.symbol)));
    const quotes = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value);
    if (!quotes.length) throw new Error('All quote providers failed');
    return quotes;
  }
  if (dataset === 'history') {
    const points = await yahooHistory('^NSEI');
    if (!points.length) throw new Error('No intraday history returned');
    return points;
  }
  if (dataset === 'news') {
    const items = await fetchNews(env);
    if (!items.length) throw new Error('All configured RSS feeds failed or returned no headlines');
    return items;
  }
  const cookie = await fetchNseCookie();
  if (dataset === 'ipos') {
    const configured = await fetchConfiguredJson(env.IPO_DATA_URL, 'IPO');
    const ipos = configured || await fetchNseIpos(cookie);
    if (!ipos.length || !validIpos(ipos)) throw new Error('No valid IPO records returned; configure a permitted normalized IPO feed if NSE is unavailable');
    return ipos;
  }
  const configured = await fetchConfiguredJson(env.FII_DII_DATA_URL, 'FII/DII');
  const flows = configured || await fetchNseFiiDii(cookie);
  if (!flows.length || !validFlows(flows)) throw new Error('No valid FII/DII records returned; configure a permitted normalized feed if NSE is unavailable');
  return flows;
}

async function yahooChart(symbol: string) {
  // Yahoo Finance chart endpoint is undocumented/unlicensed for redistribution; use only after reviewing its terms.
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`;
  const response = await fetch(endpoint, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 BazaarBrief/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Yahoo chart ${symbol}: HTTP ${response.status}`);
  const json: any = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  const closes: number[] = (quote?.close || []).filter((n: unknown): n is number => typeof n === 'number' && Number.isFinite(n));
  if (!meta || closes.length === 0) throw new Error(`No quote data for ${symbol}`);
  const value = closes[closes.length - 1];
  const previous = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes[0]);
  const change = value - previous;
  return { symbol, name: SYMBOLS.find(s => s.symbol === symbol)?.name || symbol, value, change, changePct: previous ? change / previous * 100 : 0, updatedAt: new Date((result.timestamp?.at(-1) || Math.floor(Date.now() / 1000)) * 1000).toISOString(), source: 'Yahoo Finance chart (unofficial; review redistribution terms)' };
}

function xmlText(value: string) { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
async function fetchNews(env: Env) {
  const feeds = (env.NEWS_RSS_URLS || 'https://feeds.bbci.co.uk/news/business/rss.xml,https://www.moneycontrol.com/rss/marketreports.xml,https://www.livemint.com/rss/markets').split(',').map(x => x.trim()).filter(Boolean);
  const results = await Promise.all(feeds.map(async feed => {
    const items: any[] = [];
    try {
      const r = await fetch(feed, { headers: { accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return items;
      const xml = await r.text();
      const channel = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] || xml;
      const source = xmlText(channel.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(feed).hostname);
      for (const m of channel.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
        const block = m[1];
        const get = (tag: string) => xmlText(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '');
        const title = get('title'); const link = get('link'); const desc = get('description'); const date = get('pubDate');
        if (!title || !/^https?:\/\//i.test(link)) continue;
        const lower = title.toLowerCase(); const category = /ipo|listing|public issue/.test(lower) ? 'IPO' : /oil|gold|silver|commodity/.test(lower) ? 'Commodities' : /economy|inflation|rbi|gdp/.test(lower) ? 'Economy' : 'Markets';
        items.push({ id: await sha(`${title}|${link}`), title, summary: desc.slice(0, 260), source, category, publishedAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(), url: link });
      }
    } catch { /* Keep other successful feeds. */ }
    return items;
  }));
  const items = results.flat();
  const deduped = [...new Map(items.map(item => [item.url, item])).values()];
  return deduped.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 80);
}
async function sha(text: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(bytes)].slice(0, 10).map(x => x.toString(16).padStart(2, '0')).join(''); }
async function fetchConfiguredJson(url: string | undefined, label: string) {
  if (!url) return null;
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${label} feed HTTP ${r.status}`);
  const body: any = await r.json();
  const data = Array.isArray(body) ? body : body.data;
  if (!Array.isArray(data)) throw new Error(`${label} feed must return an array or {data: []}`);
  return data;
}

const NSE_HOME = 'https://www.nseindia.com/';
async function fetchNseCookie(): Promise<string> {
  const common = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 BazaarBrief/1.0',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'referer': NSE_HOME,
    'origin': 'https://www.nseindia.com',
  };
  try {
    const landing = await fetch(NSE_HOME, { headers: { ...common, accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(8000) });
    return landing.headers.get('set-cookie')?.split(/,(?=[^;]+=[^;]+)/).map(x => x.split(';')[0]).join('; ') || '';
  } catch { return ''; }
}
async function fetchNseJson(path: string, cookie = ''): Promise<any> {
  // Unofficial public NSE website endpoints: undocumented, can change or block automated access.
  // Use only at the configured low polling frequency and review NSE data terms before redistribution.
  const common = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 BazaarBrief/1.0',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'referer': NSE_HOME,
    'origin': 'https://www.nseindia.com',
  };
  const response = await fetch(`https://www.nseindia.com${path}`, { headers: { ...common, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`NSE endpoint ${path} returned HTTP ${response.status}`);
  return response.json();
}
function asString(value: unknown): string { return value == null ? '' : String(value).trim(); }
function firstField(row: any, fields: string[]): unknown { for (const key of fields) if (row?.[key] != null && row[key] !== '') return row[key]; return undefined; }
function normalizeNseIpos(raw: any, status: 'Open' | 'Upcoming' | 'Closed' | 'Listed'): any[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  return rows.map((row: any) => {
    const name = asString(firstField(row, ['companyName', 'company', 'name', 'symbol', 'issuerName']));
    const symbol = asString(firstField(row, ['symbol', 'companySymbol', 'ticker'])) || name;
    const openDate = asString(firstField(row, ['issueStartDate', 'openDate', 'startDate', 'issueOpenDate']));
    const closeDate = asString(firstField(row, ['issueEndDate', 'closeDate', 'endDate', 'issueCloseDate']));
    const price = asString(firstField(row, ['priceRange', 'priceBand', 'issuePrice', 'price']));
    const lotRaw = firstField(row, ['lotSize', 'marketLot', 'minimumBidQuantity']);
    const lotSize = Number(String(lotRaw ?? '').replace(/[^0-9.]/g, ''));
    const size = asString(firstField(row, ['issueSize', 'issue_size', 'totalIssueSize', 'issueAmount']));
    if (!name || !openDate || !closeDate || !price || !Number.isFinite(lotSize) || lotSize <= 0 || !size) return null;
    const marketText = `${asString(firstField(row, ['series', 'market', 'board']))} ${asString(firstField(row, ['category', 'issueType']))}`.toLowerCase();
    const market = /sme|emerge|small/.test(marketText) ? 'SME' : 'Mainboard';
    const id = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const listingDate = asString(firstField(row, ['listingDate', 'listing_date'])) || undefined;
    return { id, name, symbol, market, status, openDate, closeDate, priceBand: price, lotSize, issueSize: size, listingDate, description: 'Verify dates, price band and issue details against the official offer document and exchange disclosures.' };
  }).filter(Boolean);
}
async function fetchNseIpos(cookie = ''): Promise<any[]> {
  const paths: Array<{ path: string; status: 'Open' | 'Upcoming' | 'Closed' | 'Listed' }> = [
    { path: '/api/ipo-current-issue', status: 'Open' },
    { path: '/api/all-upcoming-issues', status: 'Upcoming' },
    { path: '/api/public-past-issues', status: 'Listed' },
  ];
  const combined: any[] = [];
  const results = await Promise.all(paths.map(async entry => {
    try { return normalizeNseIpos(await fetchNseJson(entry.path, cookie), entry.status); } catch { return []; }
  }));
  for (const rows of results) combined.push(...rows);
  return [...new Map(combined.map((item: any) => [item.id, item])).values()];
}
async function fetchNseFiiDii(cookie = ''): Promise<any[]> {
  const raw = await fetchNseJson('/api/fiidiiTradeReact', cookie);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  const byDate = new Map<string, { date: string; fii: number; dii: number }>();
  for (const row of rows) {
    const date = asString(firstField(row, ['date', 'tradeDate', 'businessDate']));
    const category = asString(firstField(row, ['category', 'investorType', 'participantType'])).toLowerCase();
    const netRaw = firstField(row, ['netValue', 'net', 'netBuySell', 'netAmount']);
    if (netRaw == null || String(netRaw).trim() === '') continue;
    const net = Number(String(netRaw).replace(/,/g, ''));
    if (!date || !Number.isFinite(net)) continue;
    const current = byDate.get(date) || { date, fii: 0, dii: 0 };
    if (/fii|fpi|foreign/.test(category)) current.fii = net;
    else if (/dii|domestic/.test(category)) current.dii = net;
    else continue;
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
function validIpos(rows: any[]): boolean {
  return Array.isArray(rows) && rows.every(x => x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.symbol === 'string' && ['Mainboard', 'SME'].includes(x.market) && ['Open', 'Upcoming', 'Closed', 'Listed'].includes(x.status) && typeof x.openDate === 'string' && typeof x.closeDate === 'string' && typeof x.priceBand === 'string' && Number.isFinite(x.lotSize) && typeof x.issueSize === 'string');
}
function validFlows(rows: any[]): boolean { return Array.isArray(rows) && rows.every(x => x && typeof x.date === 'string' && Number.isFinite(x.fii) && Number.isFinite(x.dii)); }

async function refreshAll(env: Env, origin = env.PUBLIC_ORIGIN || 'https://bazaarbrief.in') {
  // Refresh all public datasets. KV is optional; the edge cache provides short-lived caching
  // when the project is deployed without a KV namespace, so first requests can still fetch live data.
  const report: Record<string, string> = {};
  const datasets: Dataset[] = ['indices', 'history', 'news', 'ipos', 'fii-dii'];
  await Promise.all(datasets.map(async dataset => {
    try {
      const data = await fetchDataset(dataset, env);
      await writeDataset(dataset, data, origin, env);
      report[dataset] = `updated (${data.length} records)`;
    } catch (error) {
      report[dataset] = `unavailable: ${error instanceof Error ? error.message : 'upstream request failed'}`;
    }
  }));
  return report;
}

async function yahooHistory(symbol: string) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 BazaarBrief/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('History unavailable');
  const json: any = await r.json(); const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || []; const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
  return timestamps.map((time, i) => ({ time: new Date(time * 1000).toISOString(), value: closes[i] })).filter((x: any) => typeof x.value === 'number');
}
