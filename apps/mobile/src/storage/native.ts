// Native stores: Preferences (SharedPreferences) for settings, files in the app's private
// storage for the summaries (no size limit, SharedPreferences rewrites its whole file on
// every change), and the Keystore-backed secure storage for API keys. Keys never go into
// Preferences or files.
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import type { KeyValue } from './kv';

export const preferencesKV: KeyValue = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
  remove: (key) => Preferences.remove({ key }),
};

export const secureKV: KeyValue = {
  get: (key) => SecureStorage.getItem(key),
  set: (key, value) => SecureStorage.setItem(key, value),
  remove: (key) => SecureStorage.removeItem(key),
};

/** One file per key under the app's private data folder ("summaries/<key>.json"). */
const filePath = (key: string) => `summaries/${encodeURIComponent(key)}.json`;

export const filesKV: KeyValue = {
  async get(key) {
    try {
      const { data } = await Filesystem.readFile({
        path: filePath(key),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : null;
    } catch {
      return null; // no such file
    }
  },
  async set(key, value) {
    await Filesystem.writeFile({
      path: filePath(key),
      data: value,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
  async remove(key) {
    try {
      await Filesystem.deleteFile({ path: filePath(key), directory: Directory.Data });
    } catch {
      // already gone
    }
  },
};
