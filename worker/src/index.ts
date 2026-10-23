import { asString, extractIpoRows, filterPlausibleIpos, firstField, normalizeNseIpos, refreshIpoLifecycle, validIpos } from '../../src/services/ipoNormalization';
import { normalizeSubscriptionPayload } from '../../src/services/subscriptionNormalization';

export interface Env {
  ASSETS?: Fetcher;
  MARKET_CACHE?: KVNamespace;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGIN?: string;
  IPO_DATA_URL?: string;
  IPO_DETAIL_BASE_URL?: string;
  IPO_SECONDARY_DATA_URL?: string;
  IPO_SUBSCRIPTION_DATA_URL?: string;
  NSE_IPO_ENABLED?: string;
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
function staleEdgeCacheKey(origin: string, dataset: Dataset) {
  return new Request(new URL(`/__bazaarbrief_cache/${dataset}-stale`, origin).toString(), { method: 'GET' });
}
async function readDataset(dataset: Dataset, origin: string, env: Env): Promise<string | null> {
  if (env.MARKET_CACHE) {
    try {
      const raw = await env.MARKET_CACHE.get(CACHE_KEYS[dataset]);
      if (raw) return raw;
    } catch { /* Continue to edge cache and live upstreams if KV is not bound or unavailable. */ }
  }
  // KV is preferred for a globally shared snapshot. If it is not configured, use
  // the regional edge cache as a degraded mode so the public IPO page does not fail
  // solely because an optional binding has not yet been added.
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
  let kvSnapshotSaved = false;
  if (env.MARKET_CACHE) {
    try {
      await env.MARKET_CACHE.put(CACHE_KEYS[dataset], raw, { expirationTtl: dataset === 'ipos' ? 60 * 60 * 24 * 365 : Math.max(DATASET_TTL[dataset] * 4, 3600) });
      kvSnapshotSaved = true;
    } catch (error) {
      // A KV outage must not discard usable upstream data. The edge cache below is
      // a temporary fallback; configure KV for a globally shared durable snapshot.
      console.warn(`[cache:${dataset}] KV write failed; using edge cache fallback`, error);
    }
    if (dataset === 'ipos' && kvSnapshotSaved) {
      const provider = (env.IPO_DATA_URL || DEFAULT_IPO_DATA_URL).includes('xflot.com') ? 'Xflot' : 'Configured IPO provider';
      try {
        await env.MARKET_CACHE.put('ipos/meta', JSON.stringify({ lastSuccessfulRefreshAt: new Date().toISOString(), recordCount: Array.isArray(data) ? data.length : 0, source: provider, provider }), { expirationTtl: 60 * 60 * 24 * 365 });
      } catch (error) {
        console.warn('[IPO cache] Snapshot saved but refresh metadata could not be updated', error);
      }
    }
  }
  const cache = edgeCache();
  if (cache) {
    try {
      const now = new Date().toISOString();
      await cache.put(edgeCacheKey(origin, dataset), new Response(raw, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${DATASET_TTL[dataset]}, s-maxage=${DATASET_TTL[dataset]}`,
          'x-bazaarbrief-cached-at': now,
        },
      }));
      // Keep a longer-lived emergency snapshot for IPOs. If an upstream feed is
      // temporarily unavailable, serve known data with an explicit stale marker.
      if (dataset === 'ipos') {
        await cache.put(staleEdgeCacheKey(origin, dataset), new Response(raw, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=86400, s-maxage=86400',
            'x-bazaarbrief-cached-at': now,
          },
        }));
      }
    } catch (error) { console.warn(`[cache:${dataset}] Edge cache write failed`, error); }
  }
}
async function readStaleIpos(origin: string, env: Env): Promise<string | null> {
  if (env.MARKET_CACHE) {
    try {
      const raw = await env.MARKET_CACHE.get(CACHE_KEYS.ipos);
      if (raw) return raw;
    } catch (error) { console.warn('[IPO cache] KV stale read failed', error); }
  }
  const cache = edgeCache();
  if (cache) {
    try {
      const cached = await cache.match(staleEdgeCacheKey(origin, 'ipos'));
      if (cached) return await cached.text();
    } catch (error) { console.warn('[IPO cache] Edge stale read failed', error); }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const h = headers(request.headers.get('Origin') || '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/api/ipos/refresh-status' && request.method === 'GET') {
      let meta: unknown = null; let lastAttempt: unknown = null;
      if (env.MARKET_CACHE) {
        try { meta = await env.MARKET_CACHE.get('ipos/meta', 'json'); } catch (error) { console.warn('[IPO status] Metadata read failed', error); }
        try { lastAttempt = await env.MARKET_CACHE.get('ipos/refresh-status', 'json'); } catch (error) { console.warn('[IPO status] Refresh status read failed', error); }
      }
      return Response.json({ dataset: 'ipos', persistentCacheEnabled: Boolean(env.MARKET_CACHE), cacheMode: env.MARKET_CACHE ? 'shared-kv-with-edge-fallback' : 'regional-edge-fallback', ...(meta && typeof meta === 'object' ? meta as object : {}), ...(lastAttempt && typeof lastAttempt === 'object' ? lastAttempt as object : {}), schedule: '*/15 * * * * UTC' }, { headers: { ...h, 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'bazaarbrief-data',
        mode: env.MARKET_CACHE ? 'live-cache+kv' : 'live-cache-fallback',
        kvEnabled: Boolean(env.MARKET_CACHE),
        ipoReady: true,
        ipoCacheMode: env.MARKET_CACHE ? 'shared-kv-with-edge-fallback' : 'regional-edge-fallback',
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
    // Prefer the shared KV snapshot; use regional edge cache and a bounded upstream
    // refresh as a fallback when KV is not configured or has not been populated yet.
    const cached = await readDataset(dataset, url.origin, env);
    if (cached) {
      // Recompute IPO lifecycle on every request so cached UPCOMING labels cannot
      // survive after bidding closes or listing day passes.
      let payload = cached;
      if (dataset === 'ipos') {
        try { const rows = JSON.parse(cached); if (Array.isArray(rows)) payload = JSON.stringify(refreshIpoLifecycle(filterPlausibleIpos(rows))); }
        catch { /* Invalid cache is ignored below by the live fetch path. */ }
      }
      return new Response(payload, { headers: { ...h, 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, stale-while-revalidate=300`, 'x-data-status': 'cached', 'x-dataset': dataset } });
    }
    try {
      const data = await fetchDataset(dataset, env);
      if (!Array.isArray(data) || data.length === 0) throw new Error('The upstream provider returned no records');
      await writeDataset(dataset, data, url.origin, env);
      return Response.json(data, { headers: { ...h, 'cache-control': `public, max-age=${DATASET_TTL[dataset]}, stale-while-revalidate=300`, 'x-data-status': 'live', 'x-dataset': dataset } });
    } catch (error) {
      if (dataset === 'ipos') {
        const stale = await readStaleIpos(url.origin, env);
        if (stale) return new Response(stale, { headers: { ...h, 'cache-control': 'public, max-age=60, stale-while-revalidate=300', 'x-data-status': 'stale-cache', 'x-dataset': 'ipos', 'warning': '110 - Response is stale; upstream feed is temporarily unavailable' } });
      }
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
    let configured: any[] | null = null;
    let usedSecondaryFallback = false;
    let usedNseFallback = false;
    try { configured = await fetchConfiguredJson(feedUrl, 'IPO'); }
    catch (error) { console.warn(`[IPO primary] feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    // The provider's documented examples use the apex host. Try the www host too
    // when the default feed fails; this handles host-specific routing/edge incidents.
    if (!configured && (!env.IPO_DATA_URL || feedUrl === DEFAULT_IPO_DATA_URL || feedUrl === DEFAULT_IPO_FALLBACK_URL)) {
      const alternate = feedUrl.includes('www.xflot.com') ? DEFAULT_IPO_DATA_URL : DEFAULT_IPO_FALLBACK_URL;
      try { configured = await fetchConfiguredJson(alternate, 'IPO alternate host'); }
      catch (error) { console.warn(`[IPO alternate host] unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    }
    // Try the separately configured, terms-reviewed secondary feed if the primary fails.
    if (!configured && env.IPO_SECONDARY_DATA_URL) {
      try { configured = await fetchConfiguredJson(env.IPO_SECONDARY_DATA_URL, 'Secondary IPO'); usedSecondaryFallback = Boolean(configured); }
      catch (error) { console.warn(`[IPO secondary fallback] unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    }
    // Optional NSE fallback is intentionally gated by explicit operator opt-in.
    if (!configured && env.NSE_IPO_ENABLED === 'true') {
      try { const cookie = await fetchNseCookie(); configured = await fetchNseJson('/api/ipo-current-issue', cookie); usedNseFallback = Boolean(configured); }
      catch (error) { console.warn(`[IPO NSE fallback] unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    }
    if (!configured) throw new Error('Primary and configured fallback IPO feeds returned no data');
    let ipos = normalizeNseIpos(configured, 'Upcoming');
    if (!ipos.length || !validIpos(ipos)) throw new Error('Configured IPO feed returned no usable records after normalization');
    // Optional official NSE public issue feed adapter. Enable only after reviewing
    // NSE terms for automated access and public redistribution; NSE may rate-limit/block Workers.
    if (env.NSE_IPO_ENABLED === 'true' && !usedNseFallback) {
      try {
        const cookie = await fetchNseCookie();
        const nseRaw = await fetchNseJson('/api/ipo-current-issue', cookie);
        const nseRows = normalizeNseIpos(nseRaw, 'Upcoming');
        const mergeKey = (item: any) => String(item.symbol || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const merged = new Map<string, any>(ipos.map(item => [mergeKey(item), item] as const));
        for (const item of nseRows) {
          const key = mergeKey(item); const existing = merged.get(key);
          if (!existing) merged.set(key, { ...item, source: 'NSE public IPO endpoint' });
          else merged.set(key, { ...existing, ...Object.fromEntries(Object.entries(item).filter(([,v]) => v !== undefined && v !== null && v !== '')), source: `${existing.source || 'Configured IPO feed'} + NSE` });
        }
        ipos = [...merged.values()];
        console.info(`[IPO NSE] merged ${nseRows.length} issue record(s)`);
      } catch (error) { console.warn(`[IPO NSE] optional feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    }
    // Optional secondary provider adapter. Configure only a feed whose terms permit
    // automated retrieval and public display. Failure is isolated from the primary feed.
    if (env.IPO_SECONDARY_DATA_URL && !usedSecondaryFallback) {
      try {
        const secondaryRaw = await fetchConfiguredJson(env.IPO_SECONDARY_DATA_URL, 'Secondary IPO');
        const secondary = normalizeNseIpos(secondaryRaw || [], 'Upcoming');
        const mergeKey = (item: any) => String(item.symbol || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const merged = new Map<string, any>(ipos.map(item => [mergeKey(item), item] as const));
        for (const item of secondary) {
          const key = mergeKey(item); const existing = merged.get(key);
          if (!existing) merged.set(key, { ...item, source: 'Secondary configured IPO provider' });
          else merged.set(key, { ...existing, ...Object.fromEntries(Object.entries(item).filter(([,v]) => v !== undefined && v !== null && v !== '')), source: `${existing.source || 'Primary IPO feed'} + secondary provider` });
        }
        ipos = [...merged.values()];
        console.info(`[IPO secondary] merged ${secondary.length} issue record(s)`);
      } catch (error) { console.warn(`[IPO secondary] optional feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`); }
    }
    // Enrich a small, relevant subset from the documented Xflot per-IPO endpoint.
    // Refresh details at most every six hours to avoid making one request per visitor
    // or multiplying provider traffic on every 15-minute list refresh.
    try {
      ipos = await enrichIposFromDetailFeed(ipos, env);
    } catch (error) {
      // Optional detail enrichment must never discard a valid primary IPO snapshot.
      console.warn(`[IPO detail] enrichment skipped: ${error instanceof Error ? error.message : 'request failed'}`);
    }
    try {
      ipos = await enrichIposFromSubscriptionFeed(ipos, env);
    } catch (error) {
      console.warn(`[IPO subscriptions] optional feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`);
    }
    return refreshIpoLifecycle(ipos);
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
  if (body && typeof body === 'object' && body.ok === false) {
    throw new Error(`${label} provider reported failure${body.error ? `: ${String(body.error).slice(0, 180)}` : ''}`);
  }
  // Support documented { ipos: [...] } and common API gateway envelopes such as
  // { data: { ipos: [...] } } without silently treating a valid payload as empty.
  const data = extractIpoRows(body);
  if (!data || data.length === 0) throw new Error(`${label} feed returned no IPO rows (expected an array or an object containing ipos/data/results)`);
  const disclaimer = asString(body?.disclaimer) || asString(body?.data?.disclaimer);
  const source = asString(body?.source) || asString(body?.provider) || 'Xflot';
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
  if (Number.isFinite(last) && Date.now() - last < 10 * 60 * 1000) return ipos;

  // Prioritize open/upcoming/closed issues and a small number of recent listings.
  const priority = (status: string) => status === 'Open' ? 0 : status === 'Upcoming' ? 1 : status === 'Closed' ? 2 : status === 'Listed' ? 3 : 4;
  const candidates = [...ipos]
    .filter(ipo => ipo && (typeof ipo.detailSlug === 'string' && ipo.detailSlug.trim() || typeof ipo.id === 'string' && ipo.id.trim() || typeof ipo.symbol === 'string' && ipo.symbol.trim()))
    .sort((a, b) => priority(a.status) - priority(b.status))
    .slice(0, 20);
  if (!candidates.length) return ipos;

  const byId = new Map<string, any>(ipos.map(ipo => [ipo.id, { ...ipo }] as const));
  let successes = 0;
  // Keep concurrency low and isolate provider failures by issue.
  for (let i = 0; i < candidates.length; i += 4) {
    const batch = candidates.slice(i, i + 4);
    await Promise.all(batch.map(async (baseIpo: any) => {
      try {
        const base = detailBase.replace(/\/$/, '');
        const detailIdentifier = baseIpo.detailSlug || baseIpo.id || baseIpo.symbol;
        const response = await fetch(`${base}/${encodeURIComponent(detailIdentifier)}`, {
          headers: { accept: 'application/json', 'user-agent': 'BazaarBrief/1.0 (+https://bazaarbrief.in)' },
          signal: AbortSignal.timeout(9000),
        });
        if (!response.ok) throw new Error(`detail HTTP ${response.status}`);
        const body: any = await response.json();
        const detail = body?.ipo || body?.data?.ipo || body?.data || body;
        if (!detail || typeof detail !== 'object') return;
        const patch: any = {};
        // Reuse the same field normalizer for provider detail payloads; only non-empty
        // values are merged, so sparse detail responses cannot erase valid list fields.
        const detailNormalized = normalizeNseIpos([detail], baseIpo.status as any)[0];
        if (detailNormalized) {
          const allowed = ['openDate','closeDate','priceBand','lotSize','issueSize','minInvestment','listingDate','faceValue','freshIssue','offerForSale','allotmentDate','refundDate','dematDate','actualListingPrice','listingGainPct','registrar','registrarUrl','registrarName','leadManager','leadManagers','offerDocumentUrl','officialUrl','description','issueObjectives','financialHighlights','financials','subscriptionHistory','investorReservations','issueType','industry','issueBreakup','quotaAllocation','registrarDetails','expectedListingPrice'];
          for (const key of allowed) { const value = detailNormalized[key]; if (value !== undefined && value !== null && value !== '') patch[key] = value; }
        }
        const history = Array.isArray(detail.gmp) ? detail.gmp : Array.isArray(detail.gmpHistory) ? detail.gmpHistory : [];
        const normalizedHistory: Array<{ date: string; gmp: number; gmpPct?: number; source?: string; unofficial?: boolean }> = history.map((row: any) => {
          const valueRaw = row?.gmp ?? row?.premium;
          const value = valueRaw == null || String(valueRaw).trim() === '' ? NaN : Number(String(valueRaw).replace(/[₹,\s]/g, '').replace(/(INR|Rs\.?)/ig, ''));
          const pctRaw = row?.gmpPct ?? row?.gmpPercent;
          const pct = pctRaw == null || String(pctRaw).trim() === '' ? NaN : Number(pctRaw);
          const date = String(row?.observedAt ?? row?.date ?? row?.updatedAt ?? '').trim();
          if (!date || !Number.isFinite(value)) return null;
          return { date, gmp: value, ...(Number.isFinite(pct) ? { gmpPct: pct } : {}), ...(row?.source ? { source: String(row.source) } : {}), ...(row?.unofficial != null ? { unofficial: Boolean(row.unofficial) } : { unofficial: true }) };
        }).filter((row: any) => row !== null).sort((a: { date: string }, b: { date: string }) => Date.parse(a.date) - Date.parse(b.date));
        if (normalizedHistory.length) {
          patch.gmpHistory = normalizedHistory;
          const latest = normalizedHistory[normalizedHistory.length - 1];
          patch.gmpObservedAt = latest.date;
          patch.gmpSource = latest.source || baseIpo.gmpSource || 'Xflot (aggregated, unofficial GMP)';
          if (baseIpo.gmp == null) patch.gmp = latest.gmp;
          if (baseIpo.gmpPct == null && latest.gmpPct != null) patch.gmpPct = latest.gmpPct;
        }
        // Reuse the same subscription normalizer for the detail endpoint so category
        // rows include offered shares, bids, applications, basis and source timestamp.
        // Never stamp the retrieval time as if it were the provider's observation time.
        const detailSubscriptions = normalizeSubscriptionPayload(detail);
        if (detailSubscriptions) {
          if (detailSubscriptions.qib !== undefined) patch.qibSubscription = detailSubscriptions.qib;
          if (detailSubscriptions.nii !== undefined) patch.niiSubscription = detailSubscriptions.nii;
          if (detailSubscriptions.smallNii !== undefined) patch.smallNiiSubscription = detailSubscriptions.smallNii;
          if (detailSubscriptions.bigNii !== undefined) patch.bigNiiSubscription = detailSubscriptions.bigNii;
          if (detailSubscriptions.retail !== undefined) patch.retailSubscription = detailSubscriptions.retail;
          if (detailSubscriptions.employee !== undefined) patch.employeeSubscription = detailSubscriptions.employee;
          if (detailSubscriptions.shareholder !== undefined) patch.shareholderSubscription = detailSubscriptions.shareholder;
          if (detailSubscriptions.total !== undefined) patch.subscription = detailSubscriptions.total;
          if (detailSubscriptions.applications !== undefined) patch.totalApplications = detailSubscriptions.applications;
          if (detailSubscriptions.subscriptionCategories?.length) patch.subscriptionCategories = detailSubscriptions.subscriptionCategories;
          if (detailSubscriptions.asOf) patch.subscriptionAsOf = detailSubscriptions.asOf;
          patch.subscriptionBasis = detailSubscriptions.basis;
          patch.subscriptionSource = 'Xflot IPO detail API';
          if (detailSubscriptions.subscriptionDetails) patch.subscriptionDetails = detailSubscriptions.subscriptionDetails;
        }
        const old = byId.get(baseIpo.id) || baseIpo;
        byId.set(baseIpo.id, { ...old, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null)) });
        successes++;
      } catch (error) {
        console.warn(`[IPO detail] ${baseIpo.detailSlug || baseIpo.id || baseIpo.symbol}: ${error instanceof Error ? error.message : 'request failed'}`);
      }
    }));
  }
  if (successes > 0) await env.MARKET_CACHE.put('ipos/detail-last-refresh', new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 7 });
  console.info(`[IPO detail] enriched ${successes}/${candidates.length} issue(s)`);
  return ipos.map(ipo => byId.get(ipo.id) || ipo);
}

const IPO_SUBSCRIPTION_BASE = 'https://ipos.markets/api/v1/subscription';
const IPO_SUBSCRIPTION_CACHE_TTL = 60 * 60 * 24 * 365;
const keyText = (value: unknown) => asString(value).toLowerCase().replace(/[^a-z0-9]/g, '');
function numberOrUndefined(value: unknown): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const parsed = Number(String(value).replace(/[,x×\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
async function safeJson(url: string, label: string): Promise<any> {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'BazaarBrief/1.0 (+https://bazaarbrief.in)' }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
  return response.json();
}
async function enrichIposFromSubscriptionFeed(ipos: any[], env: Env): Promise<any[]> {
  if (!ipos.length || !env.MARKET_CACHE) return ipos;
  const lastRaw = await env.MARKET_CACHE.get('ipos/subscription-last-refresh');
  const last = lastRaw ? Date.parse(lastRaw) : NaN;
  const hasPreviouslyEnrichedData = ipos.some(ipo => ipo.subscription !== undefined || ipo.subscriptionCategories?.length || ipo.subscriptionHistory?.length);
  // Do not let a previous zero-match/empty run suppress retries. Throttle only once
  // the current shared snapshot actually contains subscription data.
  if (hasPreviouslyEnrichedData && Number.isFinite(last) && Date.now() - last < 10 * 60 * 1000) {
    return ipos;
  }
  const manifestUrl = env.IPO_SUBSCRIPTION_DATA_URL || IPO_SUBSCRIPTION_BASE;
  const manifest = await safeJson(manifestUrl, 'IPO subscription manifest');
  const issues: any[] = Array.isArray(manifest) ? manifest
    : Array.isArray(manifest?.issues) ? manifest.issues
    : Array.isArray(manifest?.data?.issues) ? manifest.data.issues
    : Array.isArray(manifest?.data) ? manifest.data
    : Array.isArray(manifest?.items) ? manifest.items
    : Array.isArray(manifest?.data?.items) ? manifest.data.items
    : Array.isArray(manifest?.results) ? manifest.results
    : Array.isArray(manifest?.ipos) ? manifest.ipos : [];
  if (!issues.length) throw new Error('Subscription manifest did not contain a supported issue list (issues/data/items/results/ipos)');
  const aliases = (ipo: any) => new Set([ipo.symbol, ipo.detailSlug, ipo.id, ipo.name, ipo.company, ipo.companyName].map(keyText).filter(Boolean));
  const normalizedName = (value: unknown) => keyText(value).replace(/(limited|ltd|private|pvt|company|co|ipo|issue)$/g, '');
  const issueKeys = (issue: any) => [issue.symbol, issue.ticker, issue.bse, issue.nse, issue.slug, issue.id, issue.key, issue.name, issue.company, issue.companyName, issue.issuer, issue.title, issue.detailSlug].map(keyText).filter(Boolean);
  const indexed = issues.map(issue => ({ issue, keys: new Set(issueKeys(issue)), names: new Set([issue.name, issue.company, issue.companyName, issue.issuer, issue.title, issue.slug].map(normalizedName).filter(Boolean)) }));
  const matchIssue = (ipo: any) => {
    const keys = aliases(ipo);
    const exact = indexed.find(item => [...keys].some(key => item.keys.has(key)));
    if (exact) return exact;
    const wanted = new Set([ipo.name, ipo.company, ipo.companyName, ipo.detailSlug].map(normalizedName).filter(Boolean));
    const candidates = indexed.map(item => {
      const score = Math.max(0, ...[...wanted].flatMap(name => [...item.names].map(other => {
        if (!name || !other) return 0;
        if (name === other) return 1;
        const a = new Set(name.match(/[a-z0-9]{2,}/g) || []); const b = new Set(other.match(/[a-z0-9]{2,}/g) || []);
        if (a.size < 2 || b.size < 2) return 0;
        const common = [...a].filter(token => b.has(token)).length;
        return common / Math.max(a.size, b.size);
      })));
      return { item, score };
    }).sort((a,b) => b.score-a.score);
    return candidates[0]?.score >= 0.8 ? candidates[0].item : undefined;
  };
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rank = (ipo: any) => ipo.status === 'Open' ? 0 : ipo.status === 'Upcoming' ? 1 : ipo.status === 'Closed' ? 2 : 3;
  // Subscription is a current/near-current book dataset. Avoid requesting details
  // for years of historical listed IPOs on every cron; retain recent final books.
  const candidates = [...ipos]
    .filter(ipo => ipo.status === 'Open' || ipo.status === 'Upcoming' ||
      (ipo.status === 'Closed' && String(ipo.closeDate || '') >= cutoff) ||
      (ipo.status === 'Listed' && String(ipo.listingDate || '') >= cutoff))
    .sort((a,b) => rank(a)-rank(b))
    .map(ipo => { const found = matchIssue(ipo); return found ? { ipo, issue: found.issue } : null; })
    .filter(Boolean).slice(0, 25) as Array<{ipo:any;issue:any}>;
  const patches = new Map<string, any>();
  for (let offset = 0; offset < candidates.length; offset += 5) {
    await Promise.all(candidates.slice(offset, offset + 5).map(async ({ipo, issue}) => {
      try {
        let detail: any = issue;
        const rawUrl = asString(issue.url);
        const path = asString(issue.path || issue.detail_url || issue.detailUrl || issue.api_url || (rawUrl.includes('/api/') ? rawUrl : ''));
        if (path) {
          const url = new URL(path, 'https://ipos.markets');
          if (url.hostname !== 'ipos.markets' || url.protocol !== 'https:') throw new Error('Unexpected subscription path host');
          detail = await safeJson(url.toString(), `Subscription detail ${ipo.symbol}`);
        }
        const parsed = normalizeSubscriptionPayload(detail);
        if (!parsed) return;
        const rawStatus = asString(issue.status || detail?.status).toLowerCase();
        const statusMap: Record<string, string> = { open: 'Open', active: 'Open', upcoming: 'Upcoming', closed: 'Closed', listed: 'Listed', cancelled: 'Cancelled', canceled: 'Cancelled', withdrawn: 'Withdrawn' };
        const officialStatus = statusMap[rawStatus];
        const patch: any = { subscriptionSource: 'ipos.markets', ...(parsed.asOf ? { subscriptionAsOf: parsed.asOf } : {}), subscriptionBasis: parsed.basis, ...(officialStatus ? { status: officialStatus } : {}), ...(parsed.subscriptionCategories?.length ? { subscriptionCategories: parsed.subscriptionCategories } : {}) };
        if (parsed.qib !== undefined) patch.qibSubscription = parsed.qib;
        if (parsed.nii !== undefined) patch.niiSubscription = parsed.nii;
        if (parsed.smallNii !== undefined) patch.smallNiiSubscription = parsed.smallNii;
        if (parsed.bigNii !== undefined) patch.bigNiiSubscription = parsed.bigNii;
        if (parsed.retail !== undefined) patch.retailSubscription = parsed.retail;
        if (parsed.employee !== undefined) patch.employeeSubscription = parsed.employee;
        if (parsed.shareholder !== undefined) patch.shareholderSubscription = parsed.shareholder;
        if (parsed.total !== undefined) patch.subscription = parsed.total;
        if (parsed.applications !== undefined) patch.totalApplications = parsed.applications;
        if (parsed.subscriptionDetails) patch.subscriptionDetails = parsed.subscriptionDetails;
        patches.set(ipo.id, patch);
      } catch (error) { console.warn(`[IPO subscriptions] ${ipo.symbol || ipo.name}: ${error instanceof Error ? error.message : 'fetch failed'}`); }
    }));
  }
  const merged = ipos.map(ipo => ({ ...ipo, ...(patches.get(ipo.id) || {}) }));
  // Persist a daily row only for issues with actual reported subscription values.
  // This avoids a KV read for every historical IPO on every cron run.
  const withHistory = await persistDailySubscriptionHistory(merged, env);
  if (patches.size > 0) {
    await env.MARKET_CACHE.put('ipos/subscription-last-refresh', new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 7 });
  } else {
    console.warn('[IPO subscriptions] no issue details matched; leaving refresh marker unchanged so the next scheduled run retries');
  }
  console.info(`[IPO subscriptions] enriched ${patches.size}/${candidates.length} matched issues`);
  return withHistory;
}
function todayIst() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = (name: string) => parts.find(p => p.type === name)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
async function persistDailySubscriptionHistory(ipos: any[], env: Env): Promise<any[]> {
  return Promise.all(ipos.map(async ipo => {
    const current = ipo.subscriptionDetails || {};
    const snapshot = {
      qib: numberOrUndefined(current.qib ?? ipo.qibSubscription),
      nii: numberOrUndefined(current.nii ?? ipo.niiSubscription),
      smallNii: numberOrUndefined(current.smallNii ?? ipo.smallNiiSubscription),
      bigNii: numberOrUndefined(current.bigNii ?? ipo.bigNiiSubscription),
      retail: numberOrUndefined(current.retail ?? ipo.retailSubscription),
      total: numberOrUndefined(current.total ?? ipo.subscription),
      employee: numberOrUndefined(current.employee ?? ipo.employeeSubscription),
      shareholder: numberOrUndefined(ipo.shareholderSubscription),
      applications: numberOrUndefined(ipo.totalApplications),
    };
    if (![snapshot.qib,snapshot.nii,snapshot.retail,snapshot.total,snapshot.smallNii,snapshot.bigNii,snapshot.employee,snapshot.shareholder,snapshot.applications].some((n) => n !== undefined)) {
      // If no current value exists, preserve any history already merged from the
      // last known-good snapshot; don't issue one KV read per missing IPO.
      return ipo;
    }
    const key = `ipos/subscription-history/${keyText(ipo.id).slice(0,80)}`;
    try {
      const old = await env.MARKET_CACHE!.get(key, 'json') as any[] | null;
      const rows = Array.isArray(old) ? old : [];
      const date = todayIst();
      const row = { date, ...Object.fromEntries(Object.entries(snapshot).filter(([,value]) => value !== undefined)),
        ...(asString(current.asOf) || ipo.subscriptionAsOf ? { asOf: asString(current.asOf) || ipo.subscriptionAsOf } : {}), source: ipo.subscriptionSource || 'ipos.markets' };
      const byDate = new Map<string, any>(rows.filter(x => x && typeof x.date === 'string').map(x => [x.date, x] as const));
      byDate.set(date, { ...(byDate.get(date) || {}), ...row });
      const history = [...byDate.values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
      await env.MARKET_CACHE!.put(key, JSON.stringify(history), { expirationTtl: IPO_SUBSCRIPTION_CACHE_TTL });
      return { ...ipo, subscriptionHistory: history };
    } catch (error) {
      console.warn(`[IPO subscriptions] history persistence failed for ${ipo.id}`, error);
      const stored = await readSubscriptionHistory(ipo.id, env);
      return stored.length ? { ...ipo, subscriptionHistory: stored } : ipo;
    }
  }));
}
async function readSubscriptionHistory(id: string, env: Env): Promise<any[]> {
  try {
    const value = await env.MARKET_CACHE!.get(`ipos/subscription-history/${keyText(id).slice(0,80)}`, 'json');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

const NSE_HOME = 'https://www.nseindia.com/';
const DEFAULT_IPO_DATA_URL = 'https://xflot.com/api/public/market/ipos?limit=200';
const DEFAULT_IPO_FALLBACK_URL = 'https://www.xflot.com/api/public/market/ipos?limit=200';
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
  // Refresh all public datasets. KV is preferred for durable shared IPO storage;
  // if it is absent, the Worker still fetches and writes an edge-cache snapshot.
  const report: Record<string, string> = {};
  const datasets: Dataset[] = ['indices', 'history', 'news', 'ipos', 'fii-dii'];
  await Promise.all(datasets.map(async dataset => {
    try {
      let data = await fetchDataset(dataset, env);
      if (dataset === 'ipos') {
        let previousRaw: string | null = null;
        if (env.MARKET_CACHE) {
          try { previousRaw = await env.MARKET_CACHE.get(CACHE_KEYS.ipos); }
          catch (error) { console.warn('[IPO cache] Previous snapshot read failed; using fresh provider data', error); }
        }
        if (previousRaw) {
          try {
            const previous = JSON.parse(previousRaw);
            const byId = new Map<string, any>();
            for (const item of filterPlausibleIpos(Array.isArray(previous) ? previous : [])) if (item?.id) byId.set(item.id, item);
            for (const item of filterPlausibleIpos(data as any[])) { const old = byId.get(item.id); if (!old) { byId.set(item.id, item); continue; } const merged: any = { ...old, ...Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined && value !== null && value !== '')) }; if (!item.updatedAt) delete merged.updatedAt; byId.set(item.id, merged); }
            data = [...byId.values()];
          } catch (error) { console.warn('[IPO cache] Previous snapshot could not be merged', error); }
        }
      }
      if (dataset === 'ipos' && Array.isArray(data)) data = refreshIpoLifecycle(filterPlausibleIpos(data));
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
