import { readChunk, writeChunk } from './cache';

export type Adapter<T> = { name: string; fetch: () => Promise<T> };
export type Resolved<T> = {
  data: T;
  source: string;
  fetchedAt: string;
  delayed: boolean;
  errors: string[];
};

/**
 * Try providers in order. A cache-write failure must not discard a successful live
 * response; persistence is best-effort, while provider failures may use stale cache.
 */
export async function resolveDataset<T>(
  key: string,
  adapters: Adapter<T>[],
  ttl: number,
): Promise<Resolved<T>> {
  const errors: string[] = [];

  for (const adapter of adapters) {
    let data: T;
    try {
      data = await adapter.fetch();
    } catch (error) {
      errors.push(`${adapter.name}: ${error instanceof Error ? error.message : 'request failed'}`);
      continue;
    }

    try {
      const chunk = await writeChunk(key, data, ttl, adapter.name);
      return { data, source: adapter.name, fetchedAt: chunk.fetchedAt, delayed: false, errors };
    } catch (error) {
      // Do not turn a successful upstream request into a user-visible outage just
      // because IndexedDB is unavailable, full, or blocked by browser privacy mode.
      errors.push(`${adapter.name} cache write: ${error instanceof Error ? error.message : 'cache unavailable'}`);
      return { data, source: adapter.name, fetchedAt: new Date().toISOString(), delayed: false, errors };
    }
  }

  try {
    const cached = await readChunk<T>(key);
    if (cached) return { data: cached.data, source: cached.source, fetchedAt: cached.fetchedAt, delayed: true, errors };
  } catch (error) {
    errors.push(`cache read: ${error instanceof Error ? error.message : 'cache unavailable'}`);
  }

  throw new Error(`All providers failed for ${key}. ${errors.join(' | ')}`);
}
