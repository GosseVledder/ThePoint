// Message contracts between the content script, the options page and the background.
import type { ProviderId } from '@the-point/core/engine/types';
import type { ErrorInfo, JobEvent, JobRequest } from '@the-point/core/job';
import { isVideoId } from '@the-point/core/youtube/videoId';

export const SUMMARIZE_PORT = 'the-point-summarize';

export type { ErrorCode, ErrorInfo, SummaryStep } from '@the-point/core/job';

/** Content -> background, over the long-lived port. */
export type PortRequest = ({ type: 'start' } & JobRequest) | { type: 'ping' };

/** Background -> content, over the port. */
export type PortEvent = JobEvent;

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
