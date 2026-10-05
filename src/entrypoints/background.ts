import { summarizeTranscript, summarizeVideoUrl, PROVIDERS } from '../engine/summarize';
import {
  EngineError,
  type CallLog,
  type ProviderId,
  type Summary,
  type Transcript,
  type VideoMeta,
} from '../engine/types';
import {
  isAllowedRequest,
  SUMMARIZE_PORT,
  type ErrorInfo,
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
import { getApiKeys, migrateLegacyKeys, type ApiKeys } from '../storage/secrets';
import { getSettings, type Settings } from '../storage/settings';
import { installYoutubeRequestRules } from '../youtube/requestRules';
import { getTranscriptById, type VideoInfo } from '../youtube/transcript';
import { isVideoId } from '../youtube/videoId';

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
    console.warn('[yt-ai] request rules', e),
  );
  rulesReadyPromise = rulesReady;
  void migrateLegacyKeys().catch((e) => console.warn('[yt-ai] sleutels migreren', e));

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
    runJob(req, settings, keys, emit)
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

async function runJob(
  req: Extract<PortRequest, { type: 'start' }>,
  settings: Settings,
  keys: ApiKeys,
  emit: (e: PortEvent) => void,
): Promise<void> {
  const { videoId } = req;
  if (!req.forceRefresh) {
    emit({ type: 'progress', stap: 'cache' });
    const cached = await getCachedSummary(videoId, settings.taal);
    if (cached) {
      emit({ type: 'done', summary: cached, fromCache: true });
      return;
    }
  }

  const provider = settings.provider;
  const geminiKey = keys.gemini;
  const providerKey = keys[provider];
  if (!providerKey && !geminiKey) {
    throw new EngineError('no_key', 'Er is nog geen API-sleutel ingesteld.');
  }

  let info: VideoInfo | null = null;
  let transcript: Transcript | null = req.pageTranscript ?? null;
  if (!transcript) {
    emit({ type: 'progress', stap: 'transcript' });
    await rulesReadyPromise;
    try {
      const res = await withTimeout(
        getTranscriptById(videoId),
        20_000,
        'Transcript ophalen duurde te lang.',
      );
      info = res.info;
      transcript = res.transcript;
    } catch (e) {
      // YouTube refused or timed out: continue with the page transcript or Gemini.
      console.warn('[yt-ai] transcript ophalen mislukt', e);
    }
    if (info?.status === 'unavailable') {
      throw new EngineError('video_unavailable', 'Deze video is niet beschikbaar.', {
        details: info.reason,
      });
    }
  }
  const meta: VideoMeta = info?.meta ?? (await metaFor(videoId, settings, req.pageMeta));
  const log = debugLogger(settings, videoId);

  if (transcript) {
    if (!providerKey)
      throw new EngineError(
        'no_key',
        `Er is geen ${providerName(provider)}-API-sleutel ingesteld.`,
      );
    const { summary } = await summarizeTranscript(meta, transcript, {
      provider,
      apiKey: providerKey,
      model: settings.models[provider],
      taal: settings.taal,
      onProgress: (stap, d) =>
        emit({ type: 'progress', stap, provider, deel: d?.deel, delen: d?.delen }),
      onCall: log,
    });
    await finish(summary, emit);
    return;
  }

  // No transcript. 1) On the watch page, let the content script read YouTube's own
  // transcript panel first. 2) Otherwise Gemini analyses the video. 3) Otherwise an error.
  if (!req.paginaGeprobeerd) {
    emit({
      type: 'error',
      error: {
        ...(noTranscriptError(settings, geminiKey) ?? NO_TRANSCRIPT),
        tryPageTranscript: true,
      },
    });
    return;
  }
  const err = noTranscriptError(settings, geminiKey);
  if (err) {
    emit({ type: 'error', error: err });
    return;
  }
  const minuten = Math.round(meta.duurSeconden / 60);
  if (minuten > settings.bevestigVanafMinuten && !req.confirmLong) {
    emit({ type: 'confirm', minuten });
    return;
  }
  const { summary } = await summarizeVideoUrl(meta, {
    provider: 'gemini',
    apiKey: geminiKey,
    model: settings.models.gemini,
    taal: settings.taal,
    timeoutMs: 300_000,
    onProgress: (stap) => emit({ type: 'progress', stap, provider: 'gemini' }),
    onCall: log,
  });
  await finish(summary, emit);
}

const NO_TRANSCRIPT: ErrorInfo = { code: 'no_transcript', message: 'Geen transcript gevonden.' };

/** Error when no transcript route is possible; null when the Gemini video route can run. */
function noTranscriptError(settings: Settings, geminiKey: string): ErrorInfo | null {
  if (settings.geminiTerugval && geminiKey) return null;
  return {
    code: 'no_transcript',
    message: settings.geminiTerugval
      ? 'Geen transcript beschikbaar; stel een Gemini-sleutel in voor analyse op basis van de video.'
      : 'Geen transcript beschikbaar voor deze video.',
    action: settings.geminiTerugval ? 'options' : undefined,
  };
}

async function finish(summary: Summary, emit: (e: PortEvent) => void): Promise<void> {
  await setCachedSummary(summary);
  emit({ type: 'done', summary, fromCache: false });
}

async function metaFor(
  videoId: string,
  settings: Settings,
  pageMeta?: Partial<VideoMeta>,
): Promise<VideoMeta> {
  const fallback: VideoMeta = { videoId, titel: '', kanaal: '', duurSeconden: 0, ...pageMeta };
  if (pageMeta?.titel) return fallback;
  try {
    return (await getTranscriptById(videoId)).info.meta;
  } catch {
    return fallback;
  }
}

function debugLogger(settings: Settings, videoId: string) {
  return (entry: CallLog) => {
    const line = { ...entry, videoId, tijd: new Date().toISOString() };
    if (settings.debugLog) {
      console.info('[yt-ai]', line);
      void appendDebugLog(line);
    }
  };
}

function providerName(p: ProviderId): string {
  return p === 'claude' ? 'Claude' : 'Gemini';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new EngineError('timeout', message)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof EngineError) {
    const action: ErrorInfo['action'] =
      e.code === 'no_key' || e.code === 'auth' || e.code === 'model_not_found' || e.code === 'quota'
        ? 'options'
        : 'retry';
    const status = e.status ? `HTTP ${e.status}: ` : '';
    return {
      code: e.code,
      message: e.message,
      details: e.details ? `${status}${e.details}` : status || undefined,
      action,
    };
  }
  const err = e instanceof Error ? e : new Error(String(e));
  if (/failed to fetch|network/i.test(err.message)) {
    return {
      code: 'network',
      message: 'Geen internetverbinding of YouTube is niet bereikbaar.',
      details: err.message,
      action: 'retry',
    };
  }
  return {
    code: 'internal',
    message: 'Er ging iets mis bij het samenvatten.',
    details: err.stack ?? err.message,
    action: 'retry',
  };
}
