// Reading summaries aloud with the browser's free Web Speech voices.
import type { Summary } from '@yt-ai/core/engine/types';
import { getSettings, onSettingsChanged, saveSettings, type Settings } from '../storage/settings';
import {
  buildSpeechItems,
  pickVoice,
  splitForSpeech,
  type SpeechId,
  type SpeechItem,
} from '@yt-ai/core/ui/speechText';

type Synth = Pick<
  SpeechSynthesis,
  'speak' | 'cancel' | 'getVoices' | 'addEventListener' | 'removeEventListener'
> & {
  speaking: boolean;
};
type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;

export interface PlayOptions {
  voice: SpeechSynthesisVoice | null;
  lang: string;
  rate: number;
  onItem: (id: SpeechId) => void;
  onEnd: () => void;
}

/**
 * Plays a queue of items, one utterance per short chunk. Only one queue plays at a
 * time: starting a new one ends the previous one (its onEnd is called).
 */
export class Speaker {
  private run = 0;
  private current: PlayOptions | null = null;
  private voiceList: Promise<SpeechSynthesisVoice[]> | null = null;

  constructor(
    private readonly synth: Synth | undefined = globalThis.speechSynthesis,
    private readonly Utterance: UtteranceCtor | undefined = globalThis.SpeechSynthesisUtterance,
  ) {}

  get available(): boolean {
    return !!this.synth && !!this.Utterance;
  }

  /** Voices load asynchronously in Chrome; wait for `voiceschanged` (max 2 s). */
  voices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.synth) return Promise.resolve([]);
    const synth = this.synth;
    const now = synth.getVoices();
    if (now.length) return Promise.resolve(now);
    this.voiceList ??= new Promise((resolve) => {
      const done = () => {
        synth.removeEventListener('voiceschanged', done);
        clearTimeout(timer);
        const list = synth.getVoices();
        if (!list.length) this.voiceList = null; // try again next time
        resolve(list);
      };
      const timer = setTimeout(done, 2000);
      synth.addEventListener('voiceschanged', done);
    });
    return this.voiceList;
  }

  play(items: SpeechItem[], opts: PlayOptions): void {
    if (!this.synth || !this.Utterance) return;
    this.stop();
    const run = ++this.run;
    this.current = opts;
    const chunks = items.flatMap((item) =>
      splitForSpeech(item.text).map((text, i) => ({ id: item.id, text, first: i === 0 })),
    );
    if (chunks.length === 0) {
      this.finish(run);
      return;
    }
    chunks.forEach((chunk, i) => {
      const u = new this.Utterance!(chunk.text);
      if (opts.voice) u.voice = opts.voice;
      u.lang = opts.voice?.lang ?? opts.lang;
      u.rate = opts.rate;
      if (chunk.first) u.onstart = () => run === this.run && opts.onItem(chunk.id);
      if (i === chunks.length - 1) u.onend = () => this.finish(run);
      // 'interrupted'/'canceled' come from our own stop(); anything else ends the run.
      u.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') this.finish(run);
      };
      this.synth!.speak(u);
    });
  }

  stop(): void {
    const prev = this.current;
    this.run++;
    this.current = null;
    this.synth?.cancel();
    prev?.onEnd();
  }

  private finish(run: number): void {
    if (run !== this.run) return;
    const prev = this.current;
    this.current = null;
    prev?.onEnd();
  }
}

/** One speaker per page: speechSynthesis is global. */
export const speaker = new Speaker();

/**
 * Read-aloud state for one view (panel, overlay or popover): which item is being
 * read, the voice list, and the remembered voice per summary language.
 */
export class SpeechControl {
  speakingId: SpeechId | null = null;
  voices: SpeechSynthesisVoice[] = [];
  private settings: Settings | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastSummary: Summary | null = null;
  private disposed = false;

  constructor(
    private readonly onChange: () => void,
    private readonly beforePlay: () => void = () => undefined,
    private readonly sp: Speaker = speaker,
  ) {}

  get available(): boolean {
    return this.sp.available;
  }

  async init(): Promise<void> {
    this.unsubscribe = onSettingsChanged((s) => {
      this.settings = s;
      this.onChange();
    });
    const [settings, voices] = await Promise.all([getSettings(), this.sp.voices()]);
    if (this.disposed) return;
    this.settings = settings;
    this.voices = voices;
    this.onChange();
  }

  /** Summary language (from the settings). */
  get taal(): string {
    return this.settings?.taal ?? 'nl';
  }

  /** Voice that will be used: the remembered one for this language, or the best match. */
  get voiceUri(): string | null {
    if (!this.settings) return null;
    const taal = this.settings.taal;
    return pickVoice(this.voices, this.settings.stemmen[taal], taal)?.voiceURI ?? null;
  }

  play(summary: Summary, fromId: SpeechId = 'kritiek'): void {
    const settings = this.settings;
    if (!settings) return;
    const items = buildSpeechItems(summary);
    const start = Math.max(
      0,
      items.findIndex((i) => i.id === fromId),
    );
    this.lastSummary = summary;
    this.beforePlay();
    this.sp.play(items.slice(start), {
      voice: this.voices.find((v) => v.voiceURI === this.voiceUri) ?? null,
      lang: settings.taal,
      rate: settings.spreeksnelheid,
      onItem: (id) => {
        this.speakingId = id;
        this.onChange();
      },
      onEnd: () => {
        this.speakingId = null;
        if (!this.disposed) this.onChange();
      },
    });
    // Mark the first item right away; onstart can lag behind for network voices.
    this.speakingId = items[start]?.id ?? null;
    this.onChange();
  }

  stop(): void {
    if (this.speakingId !== null) this.sp.stop();
    this.speakingId = null;
  }

  /** Remember the voice for the current summary language; restart if reading. */
  async setVoice(uri: string): Promise<void> {
    const current = this.settings ?? (await getSettings());
    const next = await saveSettings({ stemmen: { ...current.stemmen, [current.taal]: uri } });
    this.settings = next;
    const resumeAt = this.speakingId;
    if (resumeAt !== null && this.lastSummary) this.play(this.lastSummary, resumeAt);
    else this.onChange();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.unsubscribe?.();
  }
}
