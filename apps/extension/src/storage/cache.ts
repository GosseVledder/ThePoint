import { summarySchema } from '@yt-ai/core/engine/schema';
import type { Summary } from '@yt-ai/core/engine/types';

const PREFIX = 'summary:';

export const cacheKey = (videoId: string, taal: string) => `${PREFIX}${videoId}:${taal}`;

export async function getCachedSummary(videoId: string, taal: string): Promise<Summary | null> {
  const key = cacheKey(videoId, taal);
  const stored = await browser.storage.local.get(key);
  const parsed = summarySchema.safeParse(stored[key]);
  return parsed.success ? parsed.data : null;
}

export async function setCachedSummary(summary: Summary): Promise<void> {
  await browser.storage.local.set({ [cacheKey(summary.videoId, summary.taal)]: summary });
}

async function allKeys(): Promise<string[]> {
  const local = browser.storage.local as typeof browser.storage.local & {
    getKeys?: () => Promise<string[]>;
  };
  // getKeys (Chrome 130+) avoids reading every summary; fall back where it is missing.
  if (typeof local.getKeys === 'function') {
    try {
      return await local.getKeys();
    } catch {
      // not implemented in this environment
    }
  }
  return Object.keys(await browser.storage.local.get(null));
}

export async function cachedSummaryKeys(): Promise<string[]> {
  return (await allKeys()).filter((k) => k.startsWith(PREFIX));
}

/** Video IDs with a cached summary in the given language. */
export async function cachedVideoIds(taal: string): Promise<string[]> {
  const suffix = `:${taal}`;
  return (await cachedSummaryKeys())
    .filter((k) => k.endsWith(suffix))
    .map((k) => k.slice(PREFIX.length, -suffix.length));
}

export async function clearCache(): Promise<number> {
  const keys = await cachedSummaryKeys();
  if (keys.length) await browser.storage.local.remove(keys);
  return keys.length;
}

/** Parse a storage key back into its parts; null for non-summary keys. */
export function parseCacheKey(key: string): { videoId: string; taal: string } | null {
  if (!key.startsWith(PREFIX)) return null;
  const [videoId, taal] = key.slice(PREFIX.length).split(':');
  return videoId && taal ? { videoId, taal } : null;
}
