// Native stores: Preferences (SharedPreferences) for settings and cache, and the
// Keystore-backed secure storage for API keys. Keys never go into Preferences.
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
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
