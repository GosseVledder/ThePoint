// Pure helpers around refinements: no provider code, so the content script can import them.
import type { Refinement, Summary } from './types';

/** Tab text for a typed instruction: its first words. */
export function labelFor(instructie: string): string {
  const words = instructie
    .trim()
    .replace(/[.?!]+$/, '')
    .split(/\s+/);
  const short = words.slice(0, 4).join(' ');
  const label = words.length > 4 ? `${short}…` : short;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** At most this many refinements are kept per summary; the oldest goes first. */
export const MAX_REFINEMENTS = 10;

/** The summary with the new refinement added (an existing one with the same instruction is replaced). */
export function withRefinement(summary: Summary, refinement: Refinement): Summary {
  const key = refinement.instructie.toLowerCase();
  const rest = (summary.verfijnd ?? []).filter((r) => r.instructie.toLowerCase() !== key);
  return { ...summary, verfijnd: [...rest, refinement].slice(-MAX_REFINEMENTS) };
}

/** The refinement with this id, if the summary has it. */
export function findRefinement(summary: Summary, id: string | null | undefined): Refinement | null {
  if (!id) return null;
  return summary.verfijnd?.find((r) => r.id === id) ?? null;
}

/** The summary as shown: with the takeaways of the active refinement, or as it is. */
export function applyRefinement(summary: Summary, id: string | null | undefined): Summary {
  const r = findRefinement(summary, id);
  return r ? { ...summary, takeaways: r.takeaways } : summary;
}
