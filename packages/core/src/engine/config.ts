import type { ProviderId } from './types';

/**
 * Default model per provider. Users can override these in the options page.
 * Checked against the provider documentation on 2026-10-10:
 * - Anthropic: claude-haiku-5-5 (fastest and cheapest of the 5.5 line), with
 *   claude-sonnet-5-5 and claude-opus-5-5 as the alternatives.
 * - Google: gemini-flash-latest is an alias that follows the newest Flash model.
 */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  claude: 'claude-haiku-5-5',
  gemini: 'gemini-flash-latest',
};

/** Suggestions shown in the options page; free text is allowed too. */
export const MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  gemini: [
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-pro-latest',
    'gemini-flash-lite-latest',
  ],
};

export const ENGINE_DEFAULTS = {
  /**
   * Transcripts longer than this (in characters, including time markers) are split
   * into chunks. Both providers have a 1M-token context, so a single call is used for
   * almost every video; that gives better takeaways than chunking.
   */
  chunkCharLimit: 400_000,
  /** Parallel chunk calls. */
  chunkConcurrency: 3,
  /** Target length of one transcript line in seconds ("[mm:ss] text"). */
  lineSeconds: 20,
  /** Output token budget (includes thinking where the model counts it). */
  maxOutputTokens: 16_000,
  /**
   * Claude's budget: no effort is sent, so each model thinks at its own default
   * (Haiku and Opus 5.5 medium, Sonnet 5.5 high), and that thinking counts toward
   * max_tokens. Only the tokens actually used are billed.
   */
  claudeMaxOutputTokens: 64_000,
  /** Per-call timeout. */
  timeoutMs: 180_000,
  /** Longest wait honoured after a 429/503 before the single retry. */
  maxRetryWaitMs: 20_000,
  /** Gemini sampling temperature (Claude models reject sampling parameters). */
  geminiTemperature: 0.2,
} as const;
