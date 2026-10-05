// API keys live in the extension's own IndexedDB, not in chrome.storage.local.
// chrome.storage.local is readable by content scripts, which run inside youtube.com
// pages; the extension origin's IndexedDB is only reachable from the background
// and the options page. Never import this module from a content script.
import type { ProviderId } from '@yt-ai/core/engine/types';

export type ApiKeys = Record<ProviderId, string>;

const DB_NAME = 'yt-ai-secrets';
const STORE = 'keys';
const RECORD = 'apiKeys';
const EMPTY: ApiKeys = { claude: '', gemini: '' };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function clean(raw: unknown): ApiKeys {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<ProviderId, unknown>>;
  return {
    claude: typeof r.claude === 'string' ? r.claude.trim() : '',
    gemini: typeof r.gemini === 'string' ? r.gemini.trim() : '',
  };
}

async function readKeys(): Promise<ApiKeys> {
  return clean(await withStore('readonly', (s) => s.get(RECORD)));
}

async function writeKeys(keys: ApiKeys): Promise<void> {
  await withStore('readwrite', (s) => s.put(clean(keys), RECORD));
}

/**
 * Versions up to 0.1.0 kept the keys inside the settings in chrome.storage.local.
 * Move them here (without overwriting newer keys) and remove them from the settings.
 */
export async function migrateLegacyKeys(): Promise<void> {
  const stored = await browser.storage.local.get('settings');
  const settings = stored.settings as { apiKeys?: unknown } | undefined;
  if (!settings || !('apiKeys' in settings)) return;
  const legacy = clean(settings.apiKeys);
  const current = await readKeys();
  await writeKeys({
    claude: current.claude || legacy.claude,
    gemini: current.gemini || legacy.gemini,
  });
  const rest: Record<string, unknown> = { ...settings };
  delete rest.apiKeys;
  await browser.storage.local.set({ settings: rest });
}

export async function getApiKeys(): Promise<ApiKeys> {
  await migrateLegacyKeys();
  return { ...EMPTY, ...(await readKeys()) };
}

export async function setApiKey(provider: ProviderId, key: string): Promise<ApiKeys> {
  const next = { ...(await getApiKeys()), [provider]: key.trim() };
  await writeKeys(next);
  return next;
}
