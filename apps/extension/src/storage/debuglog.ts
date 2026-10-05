import type { CallLog } from '@yt-ai/core/engine/types';

const KEY = 'debuglog';
const MAX = 100;

export interface DebugEntry extends CallLog {
  tijd: string;
  videoId: string;
}

export async function appendDebugLog(entry: DebugEntry): Promise<void> {
  const stored = await browser.storage.local.get(KEY);
  const list = Array.isArray(stored[KEY]) ? (stored[KEY] as DebugEntry[]) : [];
  list.push(entry);
  await browser.storage.local.set({ [KEY]: list.slice(-MAX) });
}

export async function getDebugLog(): Promise<DebugEntry[]> {
  const stored = await browser.storage.local.get(KEY);
  return Array.isArray(stored[KEY]) ? (stored[KEY] as DebugEntry[]) : [];
}

export async function clearDebugLog(): Promise<void> {
  await browser.storage.local.remove(KEY);
}
