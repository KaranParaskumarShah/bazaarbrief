import { useEffect, useRef, useState } from "react";
import { REFRESH_INTERVAL_MS } from "../config.js";
import { readCache, writeCache, isStale } from "../services/cache.js";

// Cache-first: shows the last stored value immediately (survives reloads),
// refetches only when that value is missing or older than `ttl`, and checks
// every minute in case the tab stays open past the 2-hour mark. Every
// successful fetch is written back to localStorage under `key`.
//
// `fetcher` may resolve to null to mean "not configured" (e.g. missing API
// key) rather than an error.
export function usePolling(key, fetcher, ttl = REFRESH_INTERVAL_MS) {
  const cached = readCache(key);
  const [state, setState] = useState({
    data: cached?.value ?? null,
    error: null,
    loading: !cached,
    fetchedAt: cached?.fetchedAt ?? null,
    stale: isStale(cached?.fetchedAt, ttl),
  });
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;

    async function refresh(force) {
      const current = readCache(key);
      if (!force && current && !isStale(current.fetchedAt, ttl)) {
        if (mounted.current) {
          setState({ data: current.value, error: null, loading: false, fetchedAt: current.fetchedAt, stale: false });
        }
        return;
      }
      try {
        const data = await fetcherRef.current();
        if (data !== null) writeCache(key, data);
        if (!mounted.current) return;
        setState({
          data: data !== null ? data : current?.value ?? null,
          error: null,
          loading: false,
          fetchedAt: data !== null ? Date.now() : current?.fetchedAt ?? null,
          stale: data === null,
        });
      } catch (err) {
        if (!mounted.current) return;
        setState((s) => ({
          ...s,
          error: err.message || "Failed to load",
          loading: false,
          stale: true,
        }));
      }
    }

    refresh(false);
    const timer = setInterval(() => refresh(false), 60_000);

    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
