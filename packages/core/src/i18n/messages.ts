// Interface texts of the extension and the app in several languages. The interface
// language is a setting of its own (`interfaceTaal`), separate from the summary
// language. Spoken connecting words ("Punt 1.") follow the summary language instead,
// because the voice reads the summary in that language.
import type { Summary, Takeaway } from '../engine/types';
import type { ErrorCode, ErrorInfo, SummaryStep } from '../job';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';

export const UI_LANGUAGES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'] as const;
export type UiLang = (typeof UI_LANGUAGES)[number];

/** Every language in its own name, for the interface-language menu. */
export const UI_LANGUAGE_NAMES: Record<UiLang, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
};

/** Two strings around a link or a bold part: [before, after]. */
export type Around = [string, string];

export interface Messages {
  /** BCP 47 locale for dates and numbers. */
  locale: string;
  /** Names of the summary languages, in this language. */
  languageNames: Record<string, string>;

  view: {
    steps: Record<SummaryStep, string>;
    summarizingWith: (provider: string) => string;
    zekerheid: Record<Exclude<Takeaway['zekerheid'], 'feit'>, string>;
    videoType: Record<Summary['videoType'], string>;
    density: Record<Summary['inhoudsoordeel']['dichtheid'], string>;
    switchAria: string;
    turnOff: string;
    turnOn: string;
    refresh: string;
    expand: string;
    collapse: string;
    close: string;
    off: string;
    gatePaused: string;
    watchAnyway: string;
    summarize: string;
    confirmNoTranscript: (minutes: number) => string;
    confirmYes: string;
    openSettings: string;
    retry: string;
    details: string;
    takeaways: (n: number) => string;
    noTakeaways: string;
    interview: string;
    madeWithoutTranscript: string;
    poorTranscript: string;
    sourceTranscript: string;
    sourceVideo: string;
    fromCache: (date: string) => string;
    justNow: string;
    ttsUnsupported: string;
    stop: string;
    readAloud: string;
    noVoices: string;
    voice: string;
    voiceTitle: string;
    otherLanguages: string;
    quote: (q: string) => string;
    derived: string;
    derivedTitle: string;
    unconfirmedAria: string;
    unconfirmedTitle: string;
    readFromHere: string;
    readFromPoint: (n: number) => string;
    seekTo: string;
    openAt: string;
  };

  errors: Record<ErrorCode, string> & { noTranscriptGemini: string };

  /** Spoken connecting words; taken from the summary language. */
  speech: {
    kernpunt: string;
    punt: (n: number) => string;
    zekerheid: Record<Exclude<Takeaway['zekerheid'], 'feit'>, string>;
    inDeVideo: string;
    noQuote: string;
    evidenceKernpunt: string;
    evidencePunt: (n: number) => string;
    sample: string;
  };

  /** Shared by the options page and the app's settings screen. */
  settings: {
    title: string;
    loading: string;
    autoSaved: string;
    saved: string;
    languageHeading: string;
    interfaceLanguage: string;
    summaryLanguage: string;
    aiService: string;
    providerHint: string;
    apiKey: string;
    apiKeyOf: (provider: string) => string;
    modelOf: (provider: string) => string;
    show: string;
    hide: string;
    keyHintBrowser: Around;
    keyHintDevice: Around;
    model: string;
    testConnection: string;
    busy: string;
    testOk: string;
    testOkShort: string;
    fillKeyFirst: string;
    summaryHeading: string;
    auto: string;
    autoHint: string;
    pause: string;
    pauseHint: string;
    markers: string;
    readAloudHeading: string;
    readAloudIntro: string;
    voice: string;
    speed: string;
    testVoice: string;
    stop: string;
    noVoicesBrowser: string;
    noVoicesFound: string;
    noVoiceFor: (language: string) => string;
    voicesFor: (n: number, language: string) => string;
    speechFailed: (e: string) => string;
    noTranscriptHeading: string;
    fallback: string;
    fallbackShort: string;
    fallbackHint: string;
    fallbackHintShort: string;
    confirmLonger: string;
    confirmFromMinutes: string;
    minutes: string;
    cacheHeading: string;
    savedSummaries: string;
    cacheText: string;
    clearCache: string;
    clear: string;
    cacheCount: (n: number) => string;
    summaryCount: (n: number) => string;
    confirmClear: string;
    debugHeading: string;
    debugCheck: string;
    showLog: string;
    clearLog: string;
    logEmpty: string;
    logHead: [string, string, string, string, string, string, string, string, string];
  };

  extension: {
    actionTitle: string;
    playerButton: string;
    thumbSummarize: string;
    thumbSummary: string;
    thumbTitleNew: string;
    thumbTitleCached: string;
    badge: string;
    openVideoAt: string;
  };

  app: {
    summaryTitle: string;
    /** The share action, shown bold in shareHint. */
    shareAction: string;
    back: string;
    settings: string;
    showPlayer: string;
    hidePlayer: string;
    pastePlaceholder: string;
    linkAria: string;
    notRecognized: string;
    shareHint: Around;
    recent: string;
    noSummaries: string;
    shareNoVideo: string;
    cannotPlay: (code: number | string) => string;
    openInYouTube: string;
    seekTitle: (time: string | null) => string;
    playerOff: string;
    showPlayerAndSeek: (time: string | null) => string;
    readEvidence: string;
    cancel: string;
  };
}

const DICTS: Record<UiLang, Messages> = { nl, en, de, fr, es, it, pt };

export function isUiLang(code: string): code is UiLang {
  return (UI_LANGUAGES as readonly string[]).includes(code);
}

/** Texts for a language; unknown languages fall back to English, then Dutch. */
export function messages(lang: string | undefined): Messages {
  const base = (lang ?? 'nl').toLowerCase().split('-')[0] ?? 'nl';
  return isUiLang(base) ? DICTS[base] : lang ? DICTS.en : DICTS.nl;
}

/**
 * The message to show for an error. The engine writes precise Dutch messages; other
 * languages get the translation for the error code.
 */
export function errorMessage(e: Pick<ErrorInfo, 'code' | 'message' | 'action'>, t: Messages) {
  if (t === DICTS.nl && e.message) return e.message;
  if (e.code === 'no_transcript' && e.action === 'options') return t.errors.noTranscriptGemini;
  return t.errors[e.code] ?? t.errors.internal;
}
