// Setup guide for a new user (the extension's onboarding page): tidy up a pasted key,
// a gentle format check and the friendly outcome of the key test.
import type { ErrorCode } from './job';

/** Public landing page with the same guide and an FAQ (GitHub Pages, from site/). */
export const LANDING_PAGE = 'https://gossevledder.github.io/ThePoint/';
/** Privacy statement on the landing site; the store listings link to it too. */
export const PRIVACY_PAGE = `${LANDING_PAGE}privacy.html`;

/** Video the guide's last step opens to try The Point on (TED talk with manual captions). */
export const SAMPLE_VIDEO_ID = '9Ff4S1FJdRM';

/**
 * A pasted key often brings whitespace, line breaks or quotes along; none of those
 * belong in a key.
 */
export function cleanKey(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
}

/**
 * Only a hint, never blocks saving: the key test decides. Older AI Studio keys are
 * "AIza" + 35 characters; since 2026-05-28 AI Studio creates "auth keys" (reported to
 * start with "AQ.", not documented by Google). So: an AIza key must be complete, a
 * Claude/OpenAI key ("sk-…") is wrong, anything else only needs to look like a key.
 */
export function looksLikeGeminiKey(key: string): boolean {
  if (key.startsWith('AIza')) return /^AIza[0-9A-Za-z_-]{35}$/.test(key);
  if (key.startsWith('sk-')) return false;
  return /^[0-9A-Za-z._-]{30,}$/.test(key);
}

/** What the guide tells the user after testing a key. */
export type KeyCheckOutcome = 'ok' | 'invalid' | 'limit' | 'offline' | 'other';

export function keyCheckOutcome(code: ErrorCode | null): KeyCheckOutcome {
  switch (code) {
    case null:
      return 'ok';
    case 'auth':
    case 'no_key':
      return 'invalid';
    case 'quota':
    case 'rate_limit':
      return 'limit';
    case 'network':
    case 'timeout':
      return 'offline';
    default:
      return 'other';
  }
}
