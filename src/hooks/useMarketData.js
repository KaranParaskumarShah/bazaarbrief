import { useCallback, useEffect, useRef, useState } from 'react';
import { CACHE_KEY, CACHE_TTL_MS, REFRESH_INTERVAL_MS } from '../config';
import { fetchMarketData } from '../services/api';

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!parsed?.data?.ok) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() })); } catch {}
}

export function useMarketData() {
  const cached = readCache();
  const [state, setState] = useState({
    data: cached?.data || null,
    loading: !cached?.data,
    error: null,
    lastUpdated: cached?.data?.updatedAt || null,
    cacheAge: cached ? Date.now() - cached.savedAt : null,
  });
  const mounted = useRef(true);

  const load = useCallback(async (force = false) => {
    const current = readCache();
    if (!force && current && Date.now() - current.savedAt < CACHE_TTL_MS) {
      if (mounted.current) setState(s => ({ ...s, data: current.data, loading: false, lastUpdated: current.data.updatedAt, cacheAge: Date.now() - current.savedAt }));
      return;
    }

    if (mounted.current) setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchMarketData();
      writeCache(data);
      if (mounted.current) setState({ data, loading: false, error: null, lastUpdated: data.updatedAt, cacheAge: 0 });
    } catch (error) {
      if (mounted.current) setState(s => ({ ...s, loading: false, error: error.message || 'Unable to load live data' }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    const timer = window.setInterval(() => load(true), REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { ...state, refresh: () => load(true) };
}
