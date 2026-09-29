// ─────────────────────────────────────────────────────────────────────────
// Live news — a real RSS feed, parsed in the browser, no key needed.
// ─────────────────────────────────────────────────────────────────────────
// There's no free JSON news API without a key, but RSS is free and public.
// Economic Times' Markets RSS feed is the default source, fetched through
// the same direct→relay fallback as everything else (see services/cache.js)
// since RSS feeds don't send CORS headers either, then parsed with the
// browser's built-in XML parser.
//
// If the fetch or parse ever fails, the caller keeps showing the last
// cached items automatically (see usePolling) — and if this browser has
// never fetched successfully even once, src/data/newsItems.json is used
// so the section is never empty.
//
// Not independently verified byte-for-byte against the feed's raw XML —
// this parses it as standard RSS 2.0. If headlines don't appear, open the
// feed URL in a browser tab and compare its tag names to what's read below.
// ─────────────────────────────────────────────────────────────────────────

import { resilientFetchText } from "./cache.js";

export const NEWS_FEED_URL = "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms";
export const NEWS_ITEM_COUNT = 8;

export async function fetchLatestNews() {
  const xmlText = await resilientFetchText(NEWS_FEED_URL);
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");

  if (doc.querySelector("parsererror")) throw new Error("Feed did not parse as XML");

  const items = [...doc.querySelectorAll("item")].slice(0, NEWS_ITEM_COUNT).map((item) => {
    const text = (sel) => item.querySelector(sel)?.textContent?.trim() || "";
    const pubDate = text("pubDate");
    return {
      title: text("title"),
      url: text("link"),
      date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
      summary: text("description").replace(/<[^>]+>/g, "").slice(0, 160),
    };
  }).filter((n) => n.title);

  if (items.length === 0) throw new Error("Feed returned no items");
  return items;
}
