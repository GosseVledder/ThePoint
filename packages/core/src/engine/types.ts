// Pure engine types. No chrome.*, DOM or WXT imports in src/engine/.

export type ProviderId = 'claude' | 'gemini';

export interface TranscriptSegment {
  /** Start in seconds. */
  start: number;
  /** Duration in seconds. */
  duur: number;
  tekst: string;
}

export interface Transcript {
  videoId: string;
  /** BCP-47-ish language code of the caption track, e.g. "en" or "nl". */
  taal: string;
  soort: 'handmatig' | 'automatisch';
  segmenten: TranscriptSegment[];
}

export interface VideoMeta {
  videoId: string;
  titel: string;
  kanaal: string;
  duurSeconden: number;
  /** ISO date (yyyy-mm-dd) if known. */
  publicatiedatum?: string;
}

export type VideoType =
  'nieuwsoverzicht' | 'uitleg' | 'tutorial' | 'interview' | 'opinie' | 'review' | 'overig';

export type Zekerheid = 'feit' | 'bewering' | 'mening' | 'gerucht';

export interface Takeaway {
  zin: string;
  tijd: string;
  seconden: number;
  zekerheid: Zekerheid;
  afgeleid: boolean;
  citaat: string;
  /** Set by the code checks, never by the model. */
  onbevestigd: boolean;
}

export interface Summary {
  videoId: string;
  titel: string;
  taal: string;
  bron: 'transcript' | 'gemini_video';
  provider: ProviderId;
  model: string;
  aangemaaktOp: string;
  videoType: VideoType;
  kritiekPunt: { zin: string; tijd: string | null; seconden: number | null };
  takeaways: Takeaway[];
  inhoudsoordeel: { dichtheid: 'hoog' | 'gemiddeld' | 'laag'; toelichting: string };
  isInterview: boolean;
  transcriptKwaliteit: 'goed' | 'matig' | 'slecht';
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface RawModelOutput {
  text: string;
  usage?: Usage;
  /** Model that actually answered (may differ after a server-side fallback). */
  model?: string;
}

export interface ChatRequest {
  system: string;
  user: string;
  /** JSON Schema the answer must follow. */
  schema: Record<string, unknown>;
}

export interface ProviderOptions {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injected for tests; defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Injected for tests; defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export interface SummaryProvider {
  id: ProviderId;
  complete(req: ChatRequest, opts: ProviderOptions): Promise<RawModelOutput>;
  /** Only Gemini: analyse the video itself from its public YouTube URL. */
  completeWithVideo?(url: string, req: ChatRequest, opts: ProviderOptions): Promise<RawModelOutput>;
  /** Cheap credential check that spends no tokens. */
  testConnection(opts: ProviderOptions): Promise<void>;
}

export type EngineErrorCode =
  | 'no_key'
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'timeout'
  | 'network'
  | 'invalid_json'
  | 'truncated'
  | 'refusal'
  | 'bad_request'
  | 'model_not_found'
  | 'server'
  | 'aborted'
  | 'no_transcript'
  | 'video_unavailable';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly status?: number;
  readonly details?: string;

  constructor(
    code: EngineErrorCode,
    message: string,
    opts: { status?: number; details?: string } = {},
  ) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

/** Debug record per model call. */
export interface CallLog {
  provider: ProviderId;
  model: string;
  stap: 'samenvatten' | 'deel' | 'samenvoegen' | 'herstel' | 'video';
  invoerTekens: number;
  duurMs: number;
  usage?: Usage;
  fout?: string;
}
