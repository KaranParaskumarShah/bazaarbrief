import { useEffect, useRef, useState } from "react";
import { REFRESH_INTERVAL_MS } from "../config";

/**
 * Runs `fetcher` immediately, then every `interval` ms.
 * Returns { data, error, loading, lastUpdated }.
 * `fetcher` may return null to signal "not configured" (e.g. missing API key)
 * rather than an error.
 */
export function usePolling(fetcher, deps = [], interval = REFRESH_INTERVAL_MS) {
  const [state, setState] = useState({ data: null, error: null, loading: true, lastUpdated: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer;

    async function run() {
      try {
        const data = await fetcher();
        if (!mounted.current) return;
        setState({ data, error: null, loading: false, lastUpdated: new Date() });
      } catch (err) {
        if (!mounted.current) return;
        setState((s) => ({ ...s, error: err.message || "Failed to load", loading: false }));
      }
    }

    run();
    timer = setInterval(run, interval);

    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
