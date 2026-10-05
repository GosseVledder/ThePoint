const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: string | null | undefined): value is string {
  return !!value && ID_RE.test(value);
}

/**
 * Extract the video ID from any common YouTube URL form, or from a bare ID.
 * Shorts are deliberately not recognised (out of scope for v1).
 */
export function parseVideoId(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (isVideoId(value)) return value;

  let url: URL;
  try {
    url = new URL(value, 'https://www.youtube.com');
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1];
    return isVideoId(id) ? id : null;
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;

  const v = url.searchParams.get('v');
  if (url.pathname === '/watch' && isVideoId(v)) return v;

  const m = url.pathname.match(/^\/(?:embed|live|v|e)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
  if (m?.[1]) return m[1];

  if (url.pathname === '/attribution_link') {
    const inner = url.searchParams.get('u');
    return inner ? parseVideoId(`https://www.youtube.com${inner}`) : null;
  }
  return null;
}

/** Parse a start time like "90", "90s", "1m30s", "1h2m3s" from a `t` or `start` parameter. */
export function parseStartTime(input: string | null | undefined): number | null {
  if (!input) return null;
  let value = input.trim();
  try {
    const url = new URL(value, 'https://www.youtube.com');
    if (url.search) value = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
  } catch {
    // treat as raw value
  }
  if (/^\d+s?$/.test(value)) return Number(value.replace('s', ''));
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function watchUrl(videoId: string, seconds?: number): string {
  const t = seconds && seconds > 0 ? `&t=${Math.floor(seconds)}s` : '';
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}
