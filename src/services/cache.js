// ─────────────────────────────────────────────────────────────────────────
// Why data can silently fail to show up
// ─────────────────────────────────────────────────────────────────────────
// Several free APIs don't send an Access-Control-Allow-Origin header for
// arbitrary sites, so the *browser* blocks the response (CORS) even though
// the API itself works fine. A server-side test never sees this, because
// CORS is a browser-only restriction.
//
// Fix: try the direct request first; if the browser blocks it, retry once
// through a public CORS-unblocking relay (allorigins.win). That's a
// workaround, not a permanent fix — see README for the durable fix (a tiny
// serverless function you control).
// ─────────────────────────────────────────────────────────────────────────

import { REFRESH_INTERVAL_MS } from "../config.js";

const PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

export async function resilientFetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (directErr) {
    try {
      const res = await fetch(PROXY(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (proxyErr) {
      throw new Error(`Blocked directly (${directErr.message}) and via relay (${proxyErr.message})`);
    }
  }
}

export async function resilientFetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (directErr) {
    try {
      const res = await fetch(PROXY(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (proxyErr) {
      throw new Error(`Blocked directly (${directErr.message}) and via relay (${proxyErr.message})`);
    }
  }
}

// ── localStorage cache: store what we fetch, show it immediately next time ──
const NS = "bazaarbrief:cache:";

function readCache(key) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return null;
    return JSON.parse(raw); // { value, fetchedAt }
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify({ value, fetchedAt: Date.now() }));
  } catch {
    /* storage full or unavailable — degrade to in-memory only */
  }
}

export function isStale(fetchedAt, ttl = REFRESH_INTERVAL_MS) {
  return !fetchedAt || Date.now() - fetchedAt > ttl;
}

export { readCache, writeCache };
