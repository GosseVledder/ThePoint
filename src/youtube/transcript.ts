import type { Transcript, TranscriptSegment, VideoMeta } from '../engine/types';

/**
 * Transcript retrieval. Findings from the spike (docs/spike-transcript.md):
 * - Caption URLs from the web player response return an empty body without a
 *   proof-of-origin token, so they are useless outside YouTube's own player.
 * - The InnerTube player endpoint queried as a mobile client returns caption URLs
 *   that do work, for any public video, from just the video ID.
 */

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

/** Mobile clients whose caption URLs work without a token, tried in order. */
export const INNERTUBE_CLIENTS = [
  { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30 },
  { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2' },
] as const;

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
    shortDescription?: string;
    isLiveContent?: boolean;
    isLive?: boolean;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
      audioTracks?: {
        defaultCaptionTrackIndex?: number;
        captionTrackIndices?: number[];
        audioTrackId?: string;
      }[];
      defaultAudioTrackIndex?: number;
    };
  };
}

export type PlayabilityStatus = 'ok' | 'unavailable' | 'login_required' | 'live' | 'unknown';

/** Signals for the spoken language of a video. */
export interface TrackHints {
  /**
   * Default caption track for the *viewer's* language. Depends on `hl`, so it is
   * only a weak hint about the video language.
   */
  defaultIndex?: number | null;
  /** Language of the original audio track (videos with dubbed audio), e.g. "en-US". */
  audioLanguage?: string | null;
  /** Title and description, used to guess the language when nothing else tells. */
  text?: string;
}

export interface VideoInfo {
  meta: VideoMeta;
  tracks: CaptionTrack[];
  hints: TrackHints;
  status: PlayabilityStatus;
  reason?: string;
}

export interface FetchDeps {
  fetch?: typeof fetch;
}

export async function fetchVideoInfo(videoId: string, deps: FetchDeps = {}): Promise<VideoInfo> {
  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  let lastInfo: VideoInfo | null = null;
  let lastError: unknown = null;
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await doFetch(PLAYER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Always "en": the response's default track follows the viewer language.
        body: JSON.stringify({ context: { client: { ...client, hl: 'en', gl: 'NL' } }, videoId }),
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(`player ${res.status}`);
      const info = toVideoInfo(videoId, (await res.json()) as PlayerResponse);
      if (info.tracks.length > 0 || info.status === 'unavailable') return info;
      lastInfo = info;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastInfo) return lastInfo;
  throw lastError instanceof Error ? lastError : new Error('player request failed');
}

export function toVideoInfo(videoId: string, pr: PlayerResponse): VideoInfo {
  const d = pr.videoDetails ?? {};
  const list = pr.captions?.playerCaptionsTracklistRenderer;
  const s = pr.playabilityStatus?.status;
  let status: PlayabilityStatus = 'unknown';
  if (s === 'OK') status = d.isLive ? 'live' : 'ok';
  else if (s === 'LOGIN_REQUIRED') status = 'login_required';
  else if (s === 'ERROR' || s === 'UNPLAYABLE') status = 'unavailable';
  const audio = list?.audioTracks ?? [];
  // With dubbed audio, the original track is the default one (id like "en-US.4").
  const original = audio.length > 1 ? audio[list?.defaultAudioTrackIndex ?? 0] : undefined;
  return {
    meta: {
      videoId,
      titel: d.title ?? '',
      kanaal: d.author ?? '',
      duurSeconden: Number(d.lengthSeconds ?? 0) || 0,
    },
    tracks: list?.captionTracks ?? [],
    hints: {
      defaultIndex: audio[0]?.defaultCaptionTrackIndex ?? null,
      audioLanguage: original?.audioTrackId?.split('.')[0] ?? null,
      text: `${d.title ?? ''} ${d.shortDescription ?? ''}`,
    },
    status,
    reason: pr.playabilityStatus?.reason,
  };
}

const baseLang = (code: string) => code.toLowerCase().split('-')[0] ?? code;

/** Frequent short words per language, to guess the language of a title and description. */
const STOPWORDS: Record<string, string[]> = {
  en: [
    'the',
    'and',
    'of',
    'to',
    'is',
    'in',
    'you',
    'that',
    'for',
    'with',
    'how',
    'what',
    'your',
    'are',
    'this',
    'why',
  ],
  nl: [
    'de',
    'het',
    'een',
    'en',
    'van',
    'is',
    'dat',
    'op',
    'voor',
    'met',
    'niet',
    'wat',
    'hoe',
    'je',
    'ik',
    'zijn',
  ],
  de: [
    'der',
    'die',
    'das',
    'und',
    'ist',
    'nicht',
    'mit',
    'ein',
    'eine',
    'zu',
    'auf',
    'für',
    'wie',
    'was',
    'ich',
    'sie',
  ],
  fr: [
    'le',
    'la',
    'les',
    'et',
    'est',
    'des',
    'une',
    'pour',
    'pas',
    'que',
    'qui',
    'dans',
    'sur',
    'avec',
    'vous',
    'comment',
  ],
  es: [
    'el',
    'la',
    'los',
    'las',
    'y',
    'es',
    'que',
    'una',
    'para',
    'por',
    'con',
    'como',
    'del',
    'qué',
    'más',
    'pero',
  ],
  pt: [
    'o',
    'a',
    'os',
    'as',
    'e',
    'é',
    'que',
    'um',
    'uma',
    'para',
    'com',
    'não',
    'do',
    'da',
    'como',
    'você',
  ],
  it: [
    'il',
    'la',
    'di',
    'e',
    'che',
    'è',
    'un',
    'una',
    'per',
    'con',
    'non',
    'come',
    'del',
    'della',
    'sono',
    'perché',
  ],
};

/** Best-scoring language among `candidates` for `text`, or null when there is no clear signal. */
export function guessLanguage(text: string, candidates: string[]): string | null {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  let best: string | null = null;
  let bestScore = 0;
  for (const lang of new Set(candidates.map(baseLang))) {
    const list = STOPWORDS[lang];
    if (!list) continue;
    const score = words.filter((w) => list.includes(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

/**
 * Spoken language of the video, from the strongest signal available:
 * original audio track, the only auto-generated track, title and description,
 * the default track, English, the first track.
 */
export function videoLanguage(tracks: CaptionTrack[], hints: TrackHints = {}): string | null {
  if (tracks.length === 0) return null;
  const has = (lang: string) => tracks.some((t) => baseLang(t.languageCode) === baseLang(lang));
  if (hints.audioLanguage && has(hints.audioLanguage)) return baseLang(hints.audioLanguage);
  const asr = tracks.filter((t) => t.kind === 'asr');
  if (asr.length === 1) return baseLang(asr[0]!.languageCode);
  const guessed = hints.text
    ? guessLanguage(
        hints.text,
        tracks.map((t) => t.languageCode),
      )
    : null;
  if (guessed) return guessed;
  const def = hints.defaultIndex != null ? tracks[hints.defaultIndex] : undefined;
  if (def) return baseLang(def.languageCode);
  if (has('en')) return 'en';
  return baseLang(tracks[0]!.languageCode);
}

/**
 * Track choice from the plan: manual captions in the video language, then
 * auto-generated in the video language, then manual English, then any manual, then any.
 */
export function pickTrack(tracks: CaptionTrack[], hints: TrackHints = {}): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const lang = videoLanguage(tracks, hints);
  const sameLang = (t: CaptionTrack) => lang !== null && baseLang(t.languageCode) === lang;
  const manual = (t: CaptionTrack) => t.kind !== 'asr';
  return (
    tracks.find((t) => manual(t) && sameLang(t)) ??
    tracks.find((t) => !manual(t) && sameLang(t)) ??
    tracks.find((t) => manual(t) && baseLang(t.languageCode) === 'en') ??
    tracks.find(manual) ??
    tracks[0] ??
    null
  );
}

interface Json3 {
  events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
}

export function parseJson3(data: Json3): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs) continue;
    const tekst = ev.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/[\u200b\u200e\u200f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!tekst) continue;
    out.push({ start: (ev.tStartMs ?? 0) / 1000, duur: (ev.dDurationMs ?? 0) / 1000, tekst });
  }
  return out;
}

export async function fetchTrack(
  track: CaptionTrack,
  deps: FetchDeps = {},
): Promise<TranscriptSegment[]> {
  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const url = new URL(track.baseUrl, 'https://www.youtube.com');
  url.searchParams.set('fmt', 'json3');
  const res = await doFetch(url.toString(), { credentials: 'omit' });
  if (!res.ok) throw new Error(`timedtext ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return [];
  return parseJson3(JSON.parse(text) as Json3);
}

export interface TranscriptResult {
  info: VideoInfo;
  transcript: Transcript | null;
  /** Why no transcript was found, for logging and the spike report. */
  reden?: string;
}

/**
 * Strategy 1: caption tracks via the InnerTube player (works from just a video ID).
 * Returns transcript null when the video has no usable captions.
 */
export async function getTranscriptById(
  videoId: string,
  deps: FetchDeps = {},
): Promise<TranscriptResult> {
  const info = await fetchVideoInfo(videoId, deps);
  if (info.status === 'unavailable')
    return { info, transcript: null, reden: info.reason ?? 'video niet beschikbaar' };
  const ordered = orderedTracks(info.tracks, info.hints);
  if (ordered.length === 0) return { info, transcript: null, reden: 'geen ondertitels' };
  for (const track of ordered.slice(0, 3)) {
    try {
      const segmenten = await fetchTrack(track, deps);
      if (segmenten.length > 0) {
        return {
          info,
          transcript: {
            videoId,
            taal: track.languageCode,
            soort: track.kind === 'asr' ? 'automatisch' : 'handmatig',
            segmenten,
          },
        };
      }
    } catch {
      // try the next track
    }
  }
  return { info, transcript: null, reden: 'ondertitels leeg of geblokkeerd' };
}

/** Preferred track first, then the remaining tracks as backups. */
function orderedTracks(tracks: CaptionTrack[], hints: TrackHints): CaptionTrack[] {
  const first = pickTrack(tracks, hints);
  if (!first) return [];
  return [first, ...tracks.filter((t) => t !== first)];
}
