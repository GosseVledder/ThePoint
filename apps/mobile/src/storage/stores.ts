// Settings, API keys and the summary cache on top of a KeyValue store.
import { summarySchema } from '@the-point/core/engine/schema';
import type { ProviderId, Summary } from '@the-point/core/engine/types';
import { parseSettings, type Settings } from '@the-point/core/settings';
import { readJson, type KeyValue } from './kv';

const SETTINGS_KEY = 'settings';

export interface SettingsStore {
  get(): Promise<Settings>;
  save(patch: Partial<Settings>): Promise<Settings>;
}

export function createSettingsStore(kv: KeyValue): SettingsStore {
  const get = async () => parseSettings(readJson(await kv.get(SETTINGS_KEY)));
  return {
    get,
    async save(patch) {
      const next = parseSettings({ ...(await get()), ...patch });
      await kv.set(SETTINGS_KEY, JSON.stringify(next));
      return next;
    },
  };
}

export interface KeyStore {
  get(): Promise<Record<ProviderId, string>>;
  set(provider: ProviderId, value: string): Promise<void>;
}

const keyName = (p: ProviderId) => `apiKey.${p}`;

export function createKeyStore(kv: KeyValue): KeyStore {
  return {
    async get() {
      const [claude, gemini] = await Promise.all([
        kv.get(keyName('claude')),
        kv.get(keyName('gemini')),
      ]);
      return { claude: claude ?? '', gemini: gemini ?? '' };
    },
    async set(provider, value) {
      const v = value.trim();
      if (v) await kv.set(keyName(provider), v);
      else await kv.remove(keyName(provider));
    },
  };
}

export interface RecentEntry {
  videoId: string;
  taal: string;
  titel: string;
  /** ISO time the summary was stored. */
  op: string;
}

export interface SummaryCache {
  get(videoId: string, taal: string): Promise<Summary | null>;
  set(summary: Summary): Promise<void>;
  /** Newest first. */
  recent(): Promise<RecentEntry[]>;
  clear(): Promise<number>;
}

const INDEX_KEY = 'summaries';
export const cacheKey = (videoId: string, taal: string) => `summary:${videoId}:${taal}`;

/**
 * One entry per video and language, plus an index for the home screen. Beyond `limit`
 * the oldest summaries are removed, so SharedPreferences stays small.
 */
export function createSummaryCache(kv: KeyValue, limit = 100): SummaryCache {
  const readIndex = async (): Promise<RecentEntry[]> => {
    const raw = readJson(await kv.get(INDEX_KEY));
    return Array.isArray(raw)
      ? raw.filter(
          (e): e is RecentEntry =>
            !!e && typeof e.videoId === 'string' && typeof e.taal === 'string',
        )
      : [];
  };
  const same = (a: RecentEntry, videoId: string, taal: string) =>
    a.videoId === videoId && a.taal === taal;

  return {
    async get(videoId, taal) {
      const parsed = summarySchema.safeParse(readJson(await kv.get(cacheKey(videoId, taal))));
      return parsed.success ? parsed.data : null;
    },
    async set(summary) {
      const { videoId, taal } = summary;
      await kv.set(cacheKey(videoId, taal), JSON.stringify(summary));
      const entry: RecentEntry = {
        videoId,
        taal,
        titel: summary.titel,
        op: new Date().toISOString(),
      };
      const index = [entry, ...(await readIndex()).filter((e) => !same(e, videoId, taal))];
      const dropped = index.splice(limit);
      await Promise.all(dropped.map((e) => kv.remove(cacheKey(e.videoId, e.taal))));
      await kv.set(INDEX_KEY, JSON.stringify(index));
    },
    recent: readIndex,
    async clear() {
      const index = await readIndex();
      await Promise.all(index.map((e) => kv.remove(cacheKey(e.videoId, e.taal))));
      await kv.remove(INDEX_KEY);
      return index.length;
    },
  };
}
