// Where a jump to a takeaway starts. A time marker points at the transcript line with
// the quote; for something that happens on screen the commentary often follows it, so
// the video starts a little earlier. The marker and the timeline markers keep the
// moment itself; only the jump moves.
import type { Moment } from './engine/types';

/** Setting: 'slim' picks the lead per kind of moment; a number is a fixed lead in seconds. */
export type SeekMargin = 'slim' | number;

/** Seconds of lead per kind of moment with the 'slim' setting. */
export const SMART_LEAD: Record<Moment, number> = {
  gebeurtenis: 10,
  uitspraak: 4,
  onderwerp: 2,
};

/** Lead when the kind is unknown (summaries cached before the model gave it). */
export const DEFAULT_LEAD = 10;

/** Fixed choices offered next to 'slim' in the settings. */
export const FIXED_MARGINS = [10, 5, 0] as const;

export function leadSeconds(moment: Moment | undefined, margin: SeekMargin): number {
  if (margin !== 'slim') return Math.max(0, margin);
  return moment ? SMART_LEAD[moment] : DEFAULT_LEAD;
}

/** Start of the jump: the marker minus the lead, never before the start of the video. */
export function seekStart(seconds: number, moment: Moment | undefined, margin: SeekMargin): number {
  return Math.max(0, seconds - leadSeconds(moment, margin));
}
