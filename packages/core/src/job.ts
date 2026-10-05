// One summary job: cache, transcript, AI call, Gemini video fallback. Platform-neutral:
// storage, transcript fetching and logging are injected by the extension or the app.
import { summarizeTranscript, summarizeVideoUrl } from './engine/summarize';
import {
  EngineError,
  type CallLog,
  type EngineErrorCode,
  type ProviderId,
  type Summary,
  type Transcript,
  type VideoMeta,
} from './engine/types';
import type { TranscriptResult, VideoInfo } from './youtube/transcript';

export type SummaryStep =
  'cache' | 'transcript' | 'samenvatten' | 'deel' | 'samenvoegen' | 'herstel' | 'video';

export type ErrorCode = EngineErrorCode | 'internal';

export interface ErrorInfo {
  code: ErrorCode;
  /** User-facing message in Dutch. */
  message: string;
  /** Technical details for the "Details" expander. */
  details?: string;
  /** Suggested action for the UI. */
  action?: 'options' | 'retry';
  /** On the watch page the content script may try YouTube's transcript panel. */
  tryPageTranscript?: boolean;
}

export interface JobRequest {
  videoId: string;
  forceRefresh?: boolean;
  /** User confirmed the slower, more expensive video route for a long video. */
  confirmLong?: boolean;
  /** Transcript read from YouTube's own transcript panel (strategy 2). */
  pageTranscript?: Transcript;
  /** Title, channel and duration read from the watch page (fallback metadata). */
  pageMeta?: Partial<VideoMeta>;
  /** The page transcript was tried already, or is not possible (thumbnails, app). */
  paginaGeprobeerd?: boolean;
}

export type JobEvent =
  | { type: 'progress'; stap: SummaryStep; provider?: ProviderId; deel?: number; delen?: number }
  | { type: 'done'; summary: Summary; fromCache: boolean }
  | { type: 'error'; error: ErrorInfo }
  | { type: 'confirm'; minuten: number };

/** The settings a job needs; each platform stores more. */
export interface JobSettings {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  taal: string;
  geminiTerugval: boolean;
  bevestigVanafMinuten: number;
}

export interface JobDeps {
  settings: JobSettings;
  keys: Record<ProviderId, string>;
  getCached(videoId: string, taal: string): Promise<Summary | null>;
  setCached(summary: Summary): Promise<void>;
  getTranscript(videoId: string): Promise<TranscriptResult>;
  onCall?: (entry: CallLog) => void;
  /** HTTP for the AI providers; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export async function runSummaryJob(
  req: JobRequest,
  deps: JobDeps,
  emit: (e: JobEvent) => void,
): Promise<void> {
  const { videoId } = req;
  const { settings, keys } = deps;
  if (!req.forceRefresh) {
    emit({ type: 'progress', stap: 'cache' });
    const cached = await deps.getCached(videoId, settings.taal);
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
    try {
      const res = await withTimeout(
        deps.getTranscript(videoId),
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
  const meta: VideoMeta = info?.meta ?? (await metaFor(videoId, deps, req.pageMeta));
  const finish = async (summary: Summary) => {
    await deps.setCached(summary);
    emit({ type: 'done', summary, fromCache: false });
  };

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
      fetch: deps.fetch,
      onProgress: (stap, d) =>
        emit({ type: 'progress', stap, provider, deel: d?.deel, delen: d?.delen }),
      onCall: deps.onCall,
    });
    await finish(summary);
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
    fetch: deps.fetch,
    onProgress: (stap) => emit({ type: 'progress', stap, provider: 'gemini' }),
    onCall: deps.onCall,
  });
  await finish(summary);
}

const NO_TRANSCRIPT: ErrorInfo = { code: 'no_transcript', message: 'Geen transcript gevonden.' };

/** Error when no transcript route is possible; null when the Gemini video route can run. */
function noTranscriptError(settings: JobSettings, geminiKey: string): ErrorInfo | null {
  if (settings.geminiTerugval && geminiKey) return null;
  return {
    code: 'no_transcript',
    message: settings.geminiTerugval
      ? 'Geen transcript beschikbaar; stel een Gemini-sleutel in voor analyse op basis van de video.'
      : 'Geen transcript beschikbaar voor deze video.',
    action: settings.geminiTerugval ? 'options' : undefined,
  };
}

async function metaFor(
  videoId: string,
  deps: JobDeps,
  pageMeta?: Partial<VideoMeta>,
): Promise<VideoMeta> {
  const fallback: VideoMeta = { videoId, titel: '', kanaal: '', duurSeconden: 0, ...pageMeta };
  if (pageMeta?.titel) return fallback;
  try {
    return (await deps.getTranscript(videoId)).info.meta;
  } catch {
    return fallback;
  }
}

export function providerName(p: ProviderId): string {
  return p === 'claude' ? 'Claude' : 'Gemini';
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
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

export function toErrorInfo(e: unknown): ErrorInfo {
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
