import { PROVIDERS } from '@the-point/core/engine/summarize';
import type { CallLog, ProviderId } from '@the-point/core/engine/types';
import { runSummaryJob, toErrorInfo, type JobDeps } from '@the-point/core/job';
import { getTranscriptById } from '@the-point/core/youtube/transcript';
import { isVideoId } from '@the-point/core/youtube/videoId';
import {
  isAllowedRequest,
  SUMMARIZE_PORT,
  type PortEvent,
  type PortRequest,
  type RuntimeRequest,
  type TestConnectionResult,
} from '../messages';
import {
  cachedVideoIds,
  clearCache,
  cachedSummaryKeys,
  getCachedSummary,
  setCachedSummary,
} from '../storage/cache';
import { appendDebugLog, clearDebugLog, getDebugLog } from '../storage/debuglog';
import { getApiKeys, migrateLegacyKeys } from '../storage/secrets';
import { getSettings, onSettingsChanged, type Settings } from '../storage/settings';
import { messages } from '@the-point/core/i18n/messages';
import { installYoutubeRequestRules } from '../youtube/requestRules';

type Listener = (event: PortEvent) => void;

interface Job {
  listeners: Set<Listener>;
  /** Last progress event, replayed to listeners that join later. */
  last?: PortEvent;
}

/** Running summaries per video+language: a second request joins the first. */
const jobs = new Map<string, Job>();
let rulesReadyPromise: Promise<unknown> = Promise.resolve();

export default defineBackground(() => {
  // Must be in place before the first transcript request (see requestRules.ts).
  const rulesReady = installYoutubeRequestRules().catch((e) =>
    console.warn('[the-point] request rules', e),
  );
  rulesReadyPromise = rulesReady;
  void migrateLegacyKeys().catch((e) => console.warn('[the-point] sleutels migreren', e));

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== SUMMARIZE_PORT || port.sender?.id !== browser.runtime.id) return;
    let detach: (() => void) | null = null;
    port.onMessage.addListener((msg: PortRequest) => {
      if (msg.type !== 'start') return; // 'ping' only keeps the worker alive
      if (!isVideoId(msg.videoId)) return;
      detach?.();
      const send: Listener = (e) => {
        try {
          port.postMessage(e);
        } catch {
          // port closed (tab navigated); the job still finishes and fills the cache
        }
      };
      detach = startJob(msg, send);
    });
    port.onDisconnect.addListener(() => detach?.());
  });

  browser.runtime.onMessage.addListener((msg: RuntimeRequest, sender, sendResponse) => {
    if (!isAllowedRequest(msg, sender, browser.runtime.id, browser.runtime.getURL('/'))) {
      sendResponse({ error: { code: 'internal', message: 'Niet toegestaan.' } });
      return false;
    }
    handleRuntime(msg).then(sendResponse, (e) => sendResponse({ error: toErrorInfo(e) }));
    return true;
  });

  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  // Toolbar tooltip in the interface language.
  const setTitle = (s: Settings) =>
    void browser.action.setTitle({ title: messages(s.interfaceTaal).extension.actionTitle });
  void getSettings().then(setTitle);
  onSettingsChanged(setTitle);
});

async function handleRuntime(msg: RuntimeRequest): Promise<unknown> {
  switch (msg.type) {
    case 'getCached': {
      const s = await getSettings();
      return getCachedSummary(msg.videoId, s.taal);
    }
    case 'cachedIds': {
      const s = await getSettings();
      return cachedVideoIds(s.taal);
    }
    case 'openOptions':
      await browser.runtime.openOptionsPage();
      return true;
    case 'testConnection':
      return testConnection(msg.provider, msg.apiKey, msg.model);
    case 'cacheStats':
      return { aantal: (await cachedSummaryKeys()).length };
    case 'clearCache':
      return { verwijderd: await clearCache() };
    case 'getDebugLog':
      return getDebugLog();
    case 'clearDebugLog':
      await clearDebugLog();
      return true;
    case 'getTranscript':
      await rulesReadyPromise;
      return getTranscriptById(msg.videoId);
  }
}

async function testConnection(
  provider: ProviderId,
  apiKey: string,
  model: string,
): Promise<TestConnectionResult> {
  if (!apiKey.trim())
    return { ok: false, error: { code: 'no_key', message: 'Vul eerst een API-sleutel in.' } };
  try {
    await PROVIDERS[provider].testConnection({ apiKey: apiKey.trim(), model, timeoutMs: 15_000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toErrorInfo(e) };
  }
}

function startJob(req: Extract<PortRequest, { type: 'start' }>, listener: Listener): () => void {
  const run = async () => {
    const [settings, keys] = await Promise.all([getSettings(), getApiKeys()]);
    const key = `${req.videoId}:${settings.taal}`;
    const existing = jobs.get(key);
    if (existing && !req.pageTranscript && !req.confirmLong && !req.paginaGeprobeerd) {
      existing.listeners.add(listener);
      if (existing.last) listener(existing.last);
      return () => existing.listeners.delete(listener);
    }
    const job: Job = { listeners: new Set([listener]) };
    jobs.set(key, job);
    const emit = (e: PortEvent) => {
      if (e.type === 'progress') job.last = e;
      job.listeners.forEach((l) => l(e));
    };
    runSummaryJob(req, jobDeps(settings, keys, req.videoId), emit)
      .catch((e) => emit({ type: 'error', error: toErrorInfo(e) }))
      .finally(() => {
        if (jobs.get(key) === job) jobs.delete(key);
      });
    return () => job.listeners.delete(listener);
  };
  let detach: (() => void) | null = null;
  let detached = false;
  run().then(
    (d) => {
      if (detached) d();
      else detach = d;
    },
    (e) => listener({ type: 'error', error: toErrorInfo(e) }),
  );
  return () => {
    detached = true;
    detach?.();
  };
}

function jobDeps(settings: Settings, keys: JobDeps['keys'], videoId: string): JobDeps {
  return {
    settings,
    keys,
    getCached: getCachedSummary,
    setCached: setCachedSummary,
    getTranscript: async (id) => {
      await rulesReadyPromise; // the Origin rule must be in place (see requestRules.ts)
      return getTranscriptById(id);
    },
    onCall: debugLogger(settings, videoId),
  };
}

function debugLogger(settings: Settings, videoId: string) {
  return (entry: CallLog) => {
    const line = { ...entry, videoId, tijd: new Date().toISOString() };
    if (settings.debugLog) {
      console.info('[the-point]', line);
      void appendDebugLog(line);
    }
  };
}
