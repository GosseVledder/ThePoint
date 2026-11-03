// Setup guide for a new user (the extension's onboarding page): tidy up a pasted key,
// a gentle format check and the friendly outcome of the key test.
import type { ErrorCode } from './job';

/** Public landing page with the same guide and an FAQ (GitHub Pages, from site/). */
export const LANDING_PAGE = 'https://gossevledder.github.io/ThePoint/';

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
 * Gemini keys from AI Studio are "AIza" followed by 35 letters, digits, "-" or "_".
 * Only a hint: Google may change the format, so a mismatch never blocks saving.
 */
export function looksLikeGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(key);
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
