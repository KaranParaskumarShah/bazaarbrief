import { asString, firstField, normalizeNseIpos, validIpos } from '../../src/services/ipoNormalization';

export interface Env {
  ASSETS?: Fetcher;
  MARKET_CACHE?: KVNamespace;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGIN?: string;
  IPO_DATA_URL?: string;
  IPO_DETAIL_BASE_URL?: string;
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
  // IPO data must come from the shared KV snapshot, never a region-local edge cache.
  if (dataset === 'ipos') return null;
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
    try { await env.MARKET_CACHE.put(CACHE_KEYS[dataset], raw, { expirationTtl: dataset === 'ipos' ? 60 * 60 * 24 * 365 : Math.max(DATASET_TTL[dataset] * 4, 3600) }); if (dataset === 'ipos') await env.MARKET_CACHE.put('ipos/meta', JSON.stringify({ lastSuccessfulRefreshAt: new Date().toISOString(), recordCount: Array.isArray(data) ? data.length : 0, source: (env.IPO_DATA_URL || DEFAULT_IPO_DATA_URL).includes('xflot.com') ? 'Xflot' : 'Configured IPO provider', provider: (env.IPO_DATA_URL || DEFAULT_IPO_DATA_URL).includes('xflot.com') ? 'Xflot' : 'Configured IPO provider' }), { expirationTtl: 60 * 60 * 24 * 365 }); }
    catch (error) { if (dataset === 'ipos') throw error; /* Other datasets can use edge cache when KV is unavailable. */ }
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
    if (url.pathname === '/api/ipos/refresh-status' && request.method === 'GET') {
      const meta = env.MARKET_CACHE ? await env.MARKET_CACHE.get('ipos/meta', 'json') : null;
      const lastAttempt = env.MARKET_CACHE ? await env.MARKET_CACHE.get('ipos/refresh-status', 'json') : null;
      return Response.json({ dataset: 'ipos', persistentCacheEnabled: Boolean(env.MARKET_CACHE), ...(meta && typeof meta === 'object' ? meta as object : {}), ...(lastAttempt && typeof lastAttempt === 'object' ? lastAttempt as object : {}), schedule: '*/15 * * * * UTC' }, { headers: { ...h, 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'bazaarbrief-data',
        mode: env.MARKET_CACHE ? 'live-cache+kv' : 'live-cache',
        kvEnabled: Boolean(env.MARKET_CACHE),
        ipoReady: Boolean(env.MARKET_CACHE),
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
      return Response.json({ ok: report.ipos?.startsWith('updated') === true, partialSuccess: Object.values(report).some(v => v.startsWith('updated')), refreshedAt: new Date().toISOString(), report }, { headers: { ...h, 'cache-control': 'no-store' } });
    }
    // This Worker runs before static assets so API routes can be handled here.
    // All non-API paths must fall through to the bound ASSETS service; otherwise
    // enabling run_worker_first would make the homepage and JS/CSS files return 404.
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return Response.json({ error: 'Static asset binding is unavailable', path: url.pathname }, { status: 500, headers: h });
    }
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: h });
    const match = url.pathname.match(/^\/api\/(indices|ipos|news|fii-dii|history)$/);
    if (!match) return Response.json({ error: 'Not found', path: url.pathname }, { status: 404, headers: h });
    const dataset = match[1] as Dataset;
    // The edge Cache API is regional/ephemeral, not a shared persistent source of truth.
    // Do not serve an IPO snapshot as if centralized storage were configured when KV is absent.
    if (dataset === 'ipos' && !env.MARKET_CACHE) return Response.json({ error: 'IPO persistent storage is not configured', dataset, detail: 'Bind MARKET_CACHE to a Cloudflare KV namespace, then run the scheduled or authenticated refresh.', updatedAt: null }, { status: 503, headers: { ...h, 'cache-control': 'no-store', 'x-dataset': dataset } });
    const cached = await readDataset(dataset, url.origin, env);
    if (cached) return new Response(cached, { headers: { ...h, 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, stale-while-revalidate=300`, 'x-data-status': 'cached', 'x-dataset': dataset } });
    // IPO data is intentionally never fetched on a visitor request. The shared snapshot
    // is populated only by the scheduled Worker or authenticated /admin/refresh.
    if (dataset === 'ipos') return Response.json({ error: 'IPO snapshot not initialized', dataset, detail: 'Wait for the scheduled refresh or run an authenticated admin refresh.', updatedAt: null }, { status: 503, headers: { ...h, 'cache-control': 'no-store', 'x-dataset': dataset } });
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
  if (dataset === 'ipos') {
    // Only use a provider explicitly configured for permitted automated collection and redistribution.
    // Xflot documents this no-key public JSON API and requests attribution, its disclaimer,
    // and polling no more frequently than once per minute. Cron polls only every 15 minutes.
    const feedUrl = env.IPO_DATA_URL || DEFAULT_IPO_DATA_URL;
    const configured = await fetchConfiguredJson(feedUrl, 'IPO');
    if (!configured) throw new Error('The configured/default IPO feed returned no data');
    let ipos = normalizeNseIpos(configured, 'Upcoming');
    if (!ipos.length || !validIpos(ipos)) throw new Error('Configured IPO feed returned no usable records after normalization');
    // Enrich a small, relevant subset from the documented Xflot per-IPO endpoint.
    // Refresh details at most every six hours to avoid making one request per visitor
    // or multiplying provider traffic on every 15-minute list refresh.
    ipos = await enrichIposFromDetailFeed(ipos, env);
    return ipos;
  }
  // As above, avoid a needless NSE cookie request when a feed is configured.
  const configured = await fetchConfiguredJson(env.FII_DII_DATA_URL, 'FII/DII');
  const flows = configured ?? await fetchNseFiiDii(await fetchNseCookie());
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
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (response.ok) break;
    const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === 2) throw new Error(`${label} feed HTTP ${response.status} after ${attempt + 1} attempt(s)`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2000) : 400 * (attempt + 1);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  if (!response?.ok) throw new Error(`${label} feed did not return a successful response`);
  const body: any = await response.json();
  const data = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : Array.isArray(body.ipos) ? body.ipos : null;
  if (!Array.isArray(data)) throw new Error(`${label} feed must return an array, {data: []}, or {ipos: []}`);
  const disclaimer = asString(body?.disclaimer);
  const source = asString(body?.source);
  return data.map((row: any) => ({ ...row, ...(disclaimer ? { providerDisclaimer: disclaimer } : {}), ...(source ? { providerName: source } : {}) }));
}

/**
 * Enrich list records with the documented Xflot detail endpoint. This endpoint supplies
 * GMP observations and category-wise subscription. It does not claim to provide audited
 * financial statements, registrar contact data, or all investor quotas; those remain
 * blank unless the configured list provider supplies them.
 */
async function enrichIposFromDetailFeed(ipos: any[], env: Env): Promise<any[]> {
  if (!env.MARKET_CACHE) return ipos;
  const listUrl = env.IPO_DATA_URL || DEFAULT_IPO_DATA_URL;
  const detailBase = env.IPO_DETAIL_BASE_URL || (listUrl.includes('xflot.com') ? 'https://www.xflot.com/api/public/market/ipos' : '');
  if (!detailBase) return ipos;
  const lastRaw = await env.MARKET_CACHE.get('ipos/detail-last-refresh');
  const last = lastRaw ? Date.parse(lastRaw) : NaN;
  if (Number.isFinite(last) && Date.now() - last < 6 * 60 * 60 * 1000) return ipos;

  // Prioritize open/upcoming/closed issues and a small number of recent listings.
  const priority = (status: string) => status === 'Open' ? 0 : status === 'Upcoming' ? 1 : status === 'Closed' ? 2 : status === 'Listed' ? 3 : 4;
  const candidates = [...ipos]
    .filter(ipo => ipo && typeof ipo.symbol === 'string' && ipo.symbol.trim())
    .sort((a, b) => priority(a.status) - priority(b.status))
    .slice(0, 20);
  if (!candidates.length) return ipos;

  const byId = new Map(ipos.map(ipo => [ipo.id, { ...ipo }]));
  let successes = 0;
  // Keep concurrency low and isolate provider failures by issue.
  for (let i = 0; i < candidates.length; i += 4) {
    const batch = candidates.slice(i, i + 4);
    await Promise.all(batch.map(async (baseIpo: any) => {
      try {
        const base = detailBase.replace(/\/$/, '');
        const response = await fetch(`${base}/${encodeURIComponent(baseIpo.symbol)}`, {
          headers: { accept: 'application/json', 'user-agent': 'BazaarBrief/1.0 (+https://bazaarbrief.in)' },
          signal: AbortSignal.timeout(9000),
        });
        if (!response.ok) throw new Error(`detail HTTP ${response.status}`);
        const body: any = await response.json();
        const detail = body?.ipo || body?.data?.ipo || body?.data || body;
        if (!detail || typeof detail !== 'object') return;
        const patch: any = {};
        const history = Array.isArray(detail.gmp) ? detail.gmp : Array.isArray(detail.gmpHistory) ? detail.gmpHistory : [];
        const normalizedHistory = history.map((row: any) => {
          const value = Number(row?.gmp ?? row?.premium);
          const pct = Number(row?.gmpPct ?? row?.gmpPercent);
          const date = String(row?.observedAt ?? row?.date ?? row?.updatedAt ?? '').trim();
          if (!date || !Number.isFinite(value)) return null;
          return { date, gmp: value, ...(Number.isFinite(pct) ? { gmpPct: pct } : {}), ...(row?.source ? { source: String(row.source) } : {}), ...(row?.unofficial != null ? { unofficial: Boolean(row.unofficial) } : { unofficial: true }) };
        }).filter(Boolean);
        if (normalizedHistory.length) {
          patch.gmpHistory = normalizedHistory;
          const latest = normalizedHistory[normalizedHistory.length - 1];
          patch.gmpObservedAt = latest.date;
          patch.gmpSource = latest.source || baseIpo.gmpSource || 'Xflot (aggregated, unofficial GMP)';
          if (baseIpo.gmp == null) patch.gmp = latest.gmp;
          if (baseIpo.gmpPct == null && latest.gmpPct != null) patch.gmpPct = latest.gmpPct;
        }
        const subs = Array.isArray(detail.subs) ? detail.subs : Array.isArray(detail.subscription) ? detail.subscription : [];
        if (subs.length) {
          const findSub = (pattern: RegExp) => {
            const row = subs.find((item: any) => pattern.test(String(item?.category ?? item?.name ?? item?.type ?? '')));
            const value = Number(row?.timesSub ?? row?.subscription ?? row?.times ?? row?.value);
            return Number.isFinite(value) ? value : undefined;
          };
          patch.qibSubscription = baseIpo.qibSubscription ?? findSub(/\bqib\b|qualified institutional/i);
          patch.niiSubscription = baseIpo.niiSubscription ?? findSub(/\bnii\b|hni|non.institutional/i);
          patch.retailSubscription = baseIpo.retailSubscription ?? findSub(/retail|rii/i);
          patch.employeeSubscription = baseIpo.employeeSubscription ?? findSub(/employee/i);
          patch.shareholderSubscription = baseIpo.shareholderSubscription ?? findSub(/shareholder/i);
          patch.subscription = baseIpo.subscription ?? findSub(/^total$|overall/i);
        }
        const old = byId.get(baseIpo.id) || baseIpo;
        byId.set(baseIpo.id, { ...old, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null)) });
        successes++;
      } catch (error) {
        console.warn(`[IPO detail] ${baseIpo.symbol}: ${error instanceof Error ? error.message : 'request failed'}`);
      }
    }));
  }
  if (successes > 0) await env.MARKET_CACHE.put('ipos/detail-last-refresh', new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 7 });
  console.info(`[IPO detail] enriched ${successes}/${candidates.length} issue(s)`);
  return ipos.map(ipo => byId.get(ipo.id) || ipo);
}

const NSE_HOME = 'https://www.nseindia.com/';
const DEFAULT_IPO_DATA_URL = 'https://www.xflot.com/api/public/market/ipos?limit=200';
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
async function fetchNseFiiDii(cookie = ''): Promise<any[]> {
  const raw = await fetchNseJson('/api/fiidiiTradeReact', cookie);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.ipos) ? raw.ipos : [];
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
function validFlows(rows: any[]): boolean { return Array.isArray(rows) && rows.every(x => x && typeof x.date === 'string' && Number.isFinite(x.fii) && Number.isFinite(x.dii)); }

async function refreshAll(env: Env, origin = env.PUBLIC_ORIGIN || 'https://bazaarbrief.in') {
  // Refresh all public datasets. IPO reads are cache-only; configure MARKET_CACHE KV for persistence.
  const report: Record<string, string> = {};
  const datasets: Dataset[] = ['indices', 'history', 'news', 'ipos', 'fii-dii'];
  await Promise.all(datasets.map(async dataset => {
    try {
      if (dataset === 'ipos' && !env.MARKET_CACHE) throw new Error('MARKET_CACHE KV binding is required to persist the shared IPO snapshot');
      let data = await fetchDataset(dataset, env);
      if (dataset === 'ipos') {
        const previousRaw = env.MARKET_CACHE ? await env.MARKET_CACHE.get(CACHE_KEYS.ipos) : null;
        if (previousRaw) {
          try {
            const previous = JSON.parse(previousRaw);
            const byId = new Map<string, any>();
            for (const item of Array.isArray(previous) ? previous : []) if (item?.id) byId.set(item.id, item);
            for (const item of data as any[]) { const old = byId.get(item.id); byId.set(item.id, old ? Object.fromEntries([...new Set([...Object.keys(old), ...Object.keys(item)])].map(key => [key, item[key] !== undefined && item[key] !== null && item[key] !== '' ? item[key] : old[key]])) : item); }
            data = [...byId.values()];
          } catch (error) { console.warn('[IPO cache] Previous snapshot could not be merged', error); }
        }
      }
      await writeDataset(dataset, data, origin, env);
      report[dataset] = `updated (${data.length} records)`;
    } catch (error) {
      console.error(`[refresh:${dataset}]`, error);
      report[dataset] = `unavailable: ${error instanceof Error ? error.message : 'upstream request failed'}`;
    }
  }));
  if (env.MARKET_CACHE) {
    try {
      const ipoReport = report.ipos || 'unavailable: no IPO refresh result';
      await env.MARKET_CACHE.put('ipos/refresh-status', JSON.stringify({
        lastAttemptAt: new Date().toISOString(),
        lastAttemptResult: ipoReport,
        lastAttemptSucceeded: ipoReport.startsWith('updated'),
      }), { expirationTtl: 60 * 60 * 24 * 30 });
    } catch (error) { console.warn('[IPO cache] Could not write refresh status', error); }
  }
  return report;
}

async function yahooHistory(symbol: string) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 BazaarBrief/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('History unavailable');
  const json: any = await r.json(); const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || []; const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
  return timestamps.map((time, i) => ({ time: new Date(time * 1000).toISOString(), value: closes[i] })).filter((x: any) => typeof x.value === 'number');
}
