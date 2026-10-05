import type { ModelOutput } from './schema';
import { formatTime, parseTime, type TranscriptLine } from './prompt';
import type { Summary, Takeaway } from './types';

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  // Dutch
  nul: 0,
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
  dertien: 13,
  veertien: 14,
  vijftien: 15,
  zestien: 16,
  zeventien: 17,
  achttien: 18,
  negentien: 19,
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vijftig: 50,
  zestig: 60,
  zeventig: 70,
  tachtig: 80,
  negentig: 90,
  honderd: 100,
  duizend: 1000,
  // German
  eins: 1,
  zwei: 2,
  drei: 3,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  neun: 9,
  zehn: 10,
  zwanzig: 20,
  dreißig: 30,
  hundert: 100,
  tausend: 1000,
};

/** All plausible readings of a written number: "1.200" -> {"1200","1.2"}, "2,5" -> {"25","2.5"}. */
function numberForms(raw: string): string[] {
  const forms = new Set<string>();
  const digits = raw.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
  forms.add(digits);
  const sep = raw.match(/^(\d+)[.,](\d+)$/);
  if (sep) {
    const asDecimal = `${sep[1]}.${sep[2]}`.replace(/\.?0+$/, '');
    forms.add(asDecimal);
  }
  return [...forms];
}

export function extractNumbers(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0]);
}

export function buildNumberIndex(texts: string[]): Set<string> {
  const index = new Set<string>();
  for (const text of texts) {
    for (const raw of extractNumbers(text)) numberForms(raw).forEach((f) => index.add(f));
    for (const n of wordNumbers(text)) index.add(String(n));
  }
  return index;
}

/**
 * Numbers written as words, including simple compounds:
 * "ninety-six" -> 96, "five hundred" -> 500, "two thousand twenty" -> 2020.
 * Every single number word also counts on its own.
 */
export function wordNumbers(text: string): number[] {
  const found: number[] = [];
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  let total = 0;
  let current = 0;
  let inNumber = false;
  const end = () => {
    if (inNumber) found.push(total + current);
    total = 0;
    current = 0;
    inNumber = false;
  };
  for (const word of words) {
    const n = NUMBER_WORDS[word];
    if (n === undefined) {
      if (word !== 'and' && word !== 'en') end();
      continue;
    }
    found.push(n);
    inNumber = true;
    if (n === 100) current = (current || 1) * 100;
    else if (n === 1000) {
      total += (current || 1) * 1000;
      current = 0;
    } else current += n;
  }
  end();
  return found;
}

/** True when every number in `sentence` also occurs (in some reading) in the index. */
export function numbersSupported(sentence: string, index: Set<string>): boolean {
  return extractNumbers(sentence).every((raw) => numberForms(raw).some((f) => index.has(f)));
}

interface WordIndex {
  words: string[];
  /** Line index for each word. */
  lineOf: number[];
}

export function buildWordIndex(lines: TranscriptLine[]): WordIndex {
  const words: string[] = [];
  const lineOf: number[] = [];
  lines.forEach((line, i) => {
    for (const w of normalizeText(line.tekst).split(' ')) {
      if (!w) continue;
      words.push(w);
      lineOf.push(i);
    }
  });
  return { words, lineOf };
}

/**
 * Locate a quote in the transcript. Exact (normalized) match first; otherwise a
 * sliding window that tolerates a few transcription differences (>= 85% word overlap).
 * Returns the line index where the quote starts, or -1.
 */
export function findQuote(quote: string, index: WordIndex): number {
  // Elided quotes ("first part ... second part"): every fragment must be present.
  const fragments = quote
    .split(/\s*(?:\.{3}|…|\[\.\.\.\])\s*/)
    .map((f) => f.trim())
    .filter((f) => normalizeText(f).split(' ').filter(Boolean).length >= 2);
  if (fragments.length > 1) {
    const found = fragments.map((f) => findFragment(f, index));
    return found.every((l) => l >= 0) ? (found[0] as number) : -1;
  }
  return findFragment(quote, index);
}

function findFragment(quote: string, index: WordIndex): number {
  const q = normalizeText(quote).split(' ').filter(Boolean);
  const { words, lineOf } = index;
  if (q.length === 0 || words.length === 0) return -1;

  outer: for (let i = 0; i + q.length <= words.length; i++) {
    for (let j = 0; j < q.length; j++) if (words[i + j] !== q[j]) continue outer;
    return lineOf[i] ?? -1;
  }

  if (q.length < 4) return -1;
  const need = new Map<string, number>();
  for (const w of q) need.set(w, (need.get(w) ?? 0) + 1);
  const win = q.length + 2;
  const have = new Map<string, number>();
  let overlap = 0;
  const add = (w: string) => {
    const c = have.get(w) ?? 0;
    if (c < (need.get(w) ?? 0)) overlap++;
    have.set(w, c + 1);
  };
  const remove = (w: string) => {
    const c = have.get(w) ?? 0;
    if (c <= (need.get(w) ?? 0) && c > 0) overlap--;
    have.set(w, c - 1);
  };
  let best = -1;
  let bestOverlap = 0;
  for (let i = 0; i < words.length; i++) {
    add(words[i] as string);
    if (i >= win) remove(words[i - win] as string);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      const start = Math.max(0, i - win + 1);
      // Start of the window at its first matching word.
      let s = start;
      while (s < i && !need.has(words[s] as string)) s++;
      best = lineOf[s] ?? -1;
    }
  }
  return bestOverlap / q.length >= 0.85 ? best : -1;
}

function wordSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 2),
  );
}

export function similarity(a: string, b: string): number {
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface VerifyContext {
  lines: TranscriptLine[];
  duurSeconden: number;
  /** Extra texts whose numbers count as supported (title, channel). */
  extraTexts?: string[];
}

export interface VerifyStats {
  verwijderdTijd: number;
  verwijderdDuplicaat: number;
  onbevestigdCitaat: number;
  onbevestigdGetal: number;
  tijdGecorrigeerd: number;
}

type Verified = Pick<Summary, 'kritiekPunt' | 'takeaways'>;

/** Checks from docs/PROMPT-TAKEAWAYS.md chapter 4, applied to a transcript-based answer. */
export function verifyAgainstTranscript(
  out: ModelOutput,
  ctx: VerifyContext,
): { result: Verified; stats: VerifyStats } {
  const stats: VerifyStats = {
    verwijderdTijd: 0,
    verwijderdDuplicaat: 0,
    onbevestigdCitaat: 0,
    onbevestigdGetal: 0,
    tijdGecorrigeerd: 0,
  };
  const markers = new Map<string, number>();
  ctx.lines.forEach((l, i) => markers.set(normalizeMarker(l.marker), i));
  const seconds = ctx.lines.map((l) => l.seconden);
  const words = buildWordIndex(ctx.lines);
  const numbers = buildNumberIndex([...ctx.lines.map((l) => l.tekst), ...(ctx.extraTexts ?? [])]);
  const maxSec = ctx.duurSeconden > 0 ? ctx.duurSeconden : Number.POSITIVE_INFINITY;

  /** Line index for a model-given time: exact marker, else nearest marker before it. */
  const lineForTime = (tijd: string | null): number => {
    if (!tijd) return -1;
    const exact = markers.get(normalizeMarker(tijd));
    if (exact !== undefined) return exact;
    const t = parseTime(tijd);
    if (t === null || t > maxSec) return -1;
    let idx = -1;
    for (let i = 0; i < seconds.length && (seconds[i] as number) <= t; i++) idx = i;
    return idx;
  };

  const takeaways: Takeaway[] = [];
  for (const tk of out.takeaways) {
    const quoteLine = findQuote(tk.citaat, words);
    let line = lineForTime(tk.tijd);
    const exactMarker = markers.has(normalizeMarker(tk.tijd));
    if (quoteLine >= 0 && (line < 0 || Math.abs(line - quoteLine) > 1)) {
      if (line >= 0 || !exactMarker) stats.tijdGecorrigeerd++;
      line = quoteLine;
    } else if (line >= 0 && !exactMarker) {
      stats.tijdGecorrigeerd++;
    }
    if (line < 0) {
      stats.verwijderdTijd++;
      continue;
    }
    const sec = seconds[line] as number;
    if (sec > maxSec) {
      stats.verwijderdTijd++;
      continue;
    }
    const quoteOk = quoteLine >= 0;
    const numbersOk = tk.afgeleid || numbersSupported(tk.zin, numbers);
    if (!quoteOk) stats.onbevestigdCitaat++;
    if (!numbersOk) stats.onbevestigdGetal++;
    takeaways.push({
      zin: tk.zin.trim(),
      tijd: formatTime(sec),
      seconden: sec,
      zekerheid: tk.zekerheid,
      afgeleid: tk.afgeleid,
      citaat: tk.citaat.trim(),
      onbevestigd: !quoteOk || !numbersOk,
    });
  }

  const deduped = dedupe(takeaways);
  stats.verwijderdDuplicaat = takeaways.length - deduped.length;
  deduped.sort((a, b) => a.seconden - b.seconden);

  const kpLine = lineForTime(out.kritiekPunt.tijd);
  const kpSec = kpLine >= 0 ? (seconds[kpLine] as number) : null;
  return {
    result: {
      kritiekPunt: {
        zin: out.kritiekPunt.zin.trim(),
        tijd: kpSec === null ? null : formatTime(kpSec),
        seconden: kpSec,
      },
      takeaways: deduped,
    },
    stats,
  };
}

/** Video-based answer (no transcript): only times can be checked. */
export function verifyVideoAnswer(out: ModelOutput, duurSeconden: number): Verified {
  const maxSec = duurSeconden > 0 ? duurSeconden : Number.POSITIVE_INFINITY;
  const takeaways: Takeaway[] = [];
  for (const tk of out.takeaways) {
    const sec = parseTime(tk.tijd);
    if (sec === null || sec > maxSec) continue;
    takeaways.push({
      zin: tk.zin.trim(),
      tijd: formatTime(sec),
      seconden: sec,
      zekerheid: tk.zekerheid,
      afgeleid: tk.afgeleid,
      citaat: tk.citaat.trim(),
      onbevestigd: false,
    });
  }
  const kp = parseTime(out.kritiekPunt.tijd);
  const kpSec = kp !== null && kp <= maxSec ? kp : null;
  return {
    kritiekPunt: {
      zin: out.kritiekPunt.zin.trim(),
      tijd: kpSec === null ? null : formatTime(kpSec),
      seconden: kpSec,
    },
    takeaways: dedupe(takeaways).sort((a, b) => a.seconden - b.seconden),
  };
}

export function dedupe(items: Takeaway[], threshold = 0.75): Takeaway[] {
  const kept: Takeaway[] = [];
  for (const item of items) {
    if (kept.some((k) => similarity(k.zin, item.zin) >= threshold)) continue;
    kept.push(item);
  }
  return kept;
}

function normalizeMarker(marker: string): string {
  const t = parseTime(marker);
  return t === null ? marker.trim() : String(t);
}
