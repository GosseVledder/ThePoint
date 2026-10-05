// Message contracts between the content script, the options page and the background.
import { isVideoId } from './youtube/videoId';
import type { EngineErrorCode, ProviderId, Summary, Transcript, VideoMeta } from './engine/types';

export const SUMMARIZE_PORT = 'yt-ai-summarize';

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

/** Content -> background, over the long-lived port. */
export type PortRequest =
  | {
      type: 'start';
      videoId: string;
      forceRefresh?: boolean;
      /** User confirmed the slower, more expensive video route for a long video. */
      confirmLong?: boolean;
      /** Transcript read from YouTube's own transcript panel (strategy 2). */
      pageTranscript?: Transcript;
      /** Title, channel and duration read from the watch page (fallback metadata). */
      pageMeta?: Partial<VideoMeta>;
      /** The page transcript was tried already, or is not possible (thumbnails). */
      paginaGeprobeerd?: boolean;
    }
  | { type: 'ping' };

/** Background -> content, over the port. */
export type PortEvent =
  | { type: 'progress'; stap: SummaryStep; provider?: ProviderId; deel?: number; delen?: number }
  | { type: 'done'; summary: Summary; fromCache: boolean }
  | { type: 'error'; error: ErrorInfo }
  | { type: 'confirm'; minuten: number };

/** One-shot runtime messages. */
export type RuntimeRequest =
  | { type: 'getCached'; videoId: string }
  | { type: 'cachedIds' }
  | { type: 'openOptions' }
  | { type: 'testConnection'; provider: ProviderId; apiKey: string; model: string }
  | { type: 'cacheStats' }
  | { type: 'clearCache' }
  | { type: 'getDebugLog' }
  | { type: 'clearDebugLog' }
  | { type: 'getTranscript'; videoId: string };

export type TestConnectionResult = { ok: true } | { ok: false; error: ErrorInfo };

/** Messages content scripts (inside youtube.com pages) may send. */
const CONTENT_ALLOWED: ReadonlySet<RuntimeRequest['type']> = new Set([
  'getCached',
  'cachedIds',
  'openOptions',
]);

/**
 * Only this extension may talk to the background. Requests that touch keys, the
 * debug log or the cache come only from extension pages (the options page), never
 * from a content script running in a web page.
 */
export function isAllowedRequest(
  msg: unknown,
  sender: { id?: string; url?: string },
  extensionId: string,
  extensionOrigin: string,
): msg is RuntimeRequest {
  if (sender.id !== extensionId || !msg || typeof msg !== 'object' || !('type' in msg))
    return false;
  if ('videoId' in msg && !isVideoId(msg.videoId as string)) return false;
  // Content scripts report the web page's URL; extension pages their own origin.
  const fromExtensionPage = !!sender.url?.startsWith(extensionOrigin);
  return fromExtensionPage || CONTENT_ALLOWED.has(msg.type as RuntimeRequest['type']);
}
