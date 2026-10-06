// Pure helpers for reading a summary aloud. No DOM access, so they are unit-testable.
import type { Summary } from '../engine/types';
import { messages } from '../i18n/messages';

/** 'kritiek' for the critical point, otherwise the takeaway index. */
export type SpeechId = 'kritiek' | number;

export interface SpeechItem {
  id: SpeechId;
  text: string;
}

/** The parts of SpeechSynthesisVoice we rely on (lets tests use plain objects). */
export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
}

/** Summary fields read aloud; the connecting words follow the summary language. */
type Spoken = Pick<Summary, 'kritiekPunt' | 'takeaways'> & { taal?: string };

/** Critical point first, then every takeaway; time stamps are not read. */
export function buildSpeechItems(summary: Spoken): SpeechItem[] {
  const sp = messages(summary.taal).speech;
  const items: SpeechItem[] = [
    { id: 'kritiek', text: `${sp.kernpunt} ${summary.kritiekPunt.zin}` },
  ];
  summary.takeaways.forEach((t, i) => {
    const label = t.zekerheid === 'feit' ? null : sp.zekerheid[t.zekerheid];
    const zin = t.zin.trim().replace(/[.!?…]*$/, '');
    items.push({ id: i, text: `${sp.punt(i + 1)} ${zin}${label ? `. ${label}` : ''}.` });
  });
  return items;
}

const endSentence = (s: string) => {
  const t = s.trim();
  return /[.!?…]["')\]”]?$/.test(t) ? t : `${t}.`;
};

/**
 * "Lees de onderbouwing voor" for a time stamp: the takeaway with the quote from the
 * transcript that supports it. The critical point has no quote of its own; it borrows
 * the quote of a takeaway at the same moment, if there is one.
 */
export function buildEvidenceSpeech(summary: Spoken, id: SpeechId): SpeechItem | null {
  const sp = messages(summary.taal).speech;
  if (id === 'kritiek') {
    const { zin, seconden } = summary.kritiekPunt;
    const steun = summary.takeaways.find((t) => t.seconden === seconden && t.citaat.trim());
    const citaat = steun ? ` ${sp.inDeVideo} ${endSentence(steun.citaat)}` : '';
    return { id, text: `${sp.evidenceKernpunt} ${endSentence(zin)}${citaat}` };
  }
  const t = summary.takeaways[id];
  if (!t) return null;
  const citaat = t.citaat.trim() ? ` ${sp.inDeVideo} ${endSentence(t.citaat)}` : ` ${sp.noQuote}`;
  return { id, text: `${sp.evidencePunt(id + 1)} ${endSentence(t.zin)}${citaat}` };
}

/**
 * Split text into chunks of at most `max` characters, at sentence ends, then at
 * commas/semicolons, then at spaces. Chrome cuts off long utterances with network
 * voices after about 15 seconds; short chunks avoid that.
 */
export function splitForSpeech(text: string, max = 180): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const sentences = clean.match(/[^.!?…]+[.!?…]+["')\]]?\s*|[^.!?…]+$/g) ?? [clean];
  const out: string[] = [];
  for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
    if (sentence.length <= max) {
      out.push(sentence);
      continue;
    }
    let rest = sentence;
    while (rest.length > max) {
      const window = rest.slice(0, max + 1);
      let cut = Math.max(
        window.lastIndexOf(', '),
        window.lastIndexOf('; '),
        window.lastIndexOf(': '),
      );
      if (cut < max / 3) cut = window.lastIndexOf(' ');
      if (cut <= 0) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

const baseLang = (lang: string) => lang.toLowerCase().replace('_', '-').split('-')[0] ?? '';

/** nl -> nl-NL, de -> de-DE: the "home" variant of a language beats nl-BE or de-AT. */
const homeRegion = (v: VoiceLike) => {
  const [base, region] = v.lang.replace('_', '-').split('-');
  return !!base && !!region && region.toLowerCase() === base.toLowerCase() ? 2 : 0;
};

/** Higher is better: natural/neural network voices first, then local voices. */
function quality(v: VoiceLike): number {
  let score = 0;
  if (/natural|neural|online/i.test(v.name)) score += 4;
  if (/google/i.test(v.name)) score += 3;
  if (v.localService) score += 1;
  if (v.default) score += 0.5;
  return score;
}

const score = (v: VoiceLike) => quality(v) + homeRegion(v);

/**
 * The voice to use: the saved one if it still exists, otherwise the best voice for
 * the summary language, otherwise null (browser default).
 */
export function pickVoice<V extends VoiceLike>(
  voices: V[],
  savedUri: string | undefined,
  taal: string,
): V | null {
  if (savedUri) {
    const saved = voices.find((v) => v.voiceURI === savedUri);
    if (saved) return saved;
  }
  const matching = voices.filter((v) => baseLang(v.lang) === baseLang(taal));
  if (matching.length === 0) return null;
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export interface VoiceGroup<V> {
  label: string;
  voices: V[];
}

/** Voices in the summary language first (best first), then the rest by language. */
export function groupVoices<V extends VoiceLike>(
  voices: V[],
  taal: string,
  taalNaam: string,
  otherLabel = 'Andere talen',
): VoiceGroup<V>[] {
  const mine = voices
    .filter((v) => baseLang(v.lang) === baseLang(taal))
    .sort((a, b) => score(b) - score(a));
  const other = voices
    .filter((v) => baseLang(v.lang) !== baseLang(taal))
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  const groups: VoiceGroup<V>[] = [];
  if (mine.length) groups.push({ label: taalNaam, voices: mine });
  if (other.length) groups.push({ label: otherLabel, voices: other });
  return groups;
}

/** Short label for a voice in a select: "Microsoft Fenna Online (Natural)" -> "Fenna (Natural) · nl-NL". */
export function voiceLabel(v: VoiceLike): string {
  const name = v.name
    .replace(/^(Microsoft|Google)\s+/i, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+Online\s+\(Natural\)/i, ' (Natural)')
    .trim();
  return `${name || v.name} · ${v.lang}`;
}
