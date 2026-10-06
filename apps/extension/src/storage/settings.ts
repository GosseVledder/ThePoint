import { parseSettings, type Settings } from '@the-point/core/settings';

export {
  DEFAULT_SETTINGS,
  parseSettings,
  settingsSchema,
  type Settings,
} from '@the-point/core/settings';

// API keys are not part of the settings: content scripts read these (see secrets.ts).
const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = parseSettings({ ...current, ...patch });
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes[SETTINGS_KEY])
      cb(parseSettings(changes[SETTINGS_KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
