// Read aloud through the native text-to-speech plugin (Android WebView has no
// speechSynthesis). The text and voice choice come from core's speechText.
import type { Summary } from '@the-point/core/engine/types';
import {
  buildSpeechItems,
  pickVoice,
  splitForSpeech,
  type SpeechId,
  type SpeechItem,
  type VoiceLike,
} from '@the-point/core/ui/speechText';

/** The parts of @capacitor-community/text-to-speech we use; `voice` is an index. */
export interface TtsLike {
  speak(o: { text: string; lang?: string; rate?: number; voice?: number }): Promise<void>;
  stop(): Promise<void>;
  getSupportedVoices(): Promise<{ voices: VoiceLike[] }>;
}

/**
 * Android names every voice after its locale ("Nederlands Nederland"), so voices of one
 * language look alike. The engine name ("nl-nl-x-tfb-network") tells them apart.
 */
export function androidVoiceName(v: VoiceLike): string {
  const m = v.voiceURI.match(/-x-([a-z0-9]+)-(local|network)$/i);
  const base = v.name.trim() || v.lang;
  if (!m?.[1]) return base;
  return `${base} ${m[1].toUpperCase()}${m[2] === 'network' ? ' (online)' : ''}`;
}

export interface SpeakOptions {
  taal: string;
  rate: number;
  voiceUri: string | undefined;
}

export class Speaker {
  /** Voices in the plugin's order: speak() takes the index into this list. */
  voices: VoiceLike[] = [];
  speakingId: SpeechId | null = null;
  private run = 0;

  constructor(
    private tts: TtsLike,
    private onChange: () => void,
  ) {}

  /**
   * Right after app start the Android TTS engine is still binding and reports no
   * voices; ask again a few times before giving up.
   */
  async loadVoices(attempts = 6, delayMs = 1000): Promise<VoiceLike[]> {
    for (let i = 0; i < attempts; i++) {
      try {
        const { voices } = await this.tts.getSupportedVoices();
        this.voices = voices.map((v) => ({ ...v, name: androidVoiceName(v) }));
      } catch {
        this.voices = [];
      }
      if (this.voices.length) break;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return this.voices;
  }

  /** The voice that will be used for this language (saved choice or the best match). */
  voiceFor(taal: string, savedUri: string | undefined): VoiceLike | null {
    return pickVoice(this.voices, savedUri, taal);
  }

  async speakText(text: string, opts: SpeakOptions): Promise<void> {
    const voice = this.voiceFor(opts.taal, opts.voiceUri);
    const index = voice ? this.voices.indexOf(voice) : -1;
    await this.tts.speak({
      text,
      lang: voice?.lang ?? opts.taal,
      rate: opts.rate,
      ...(index >= 0 ? { voice: index } : {}),
    });
  }

  /** Critical point and takeaways, from `from` on; stops when stop() is called. */
  async speak(
    summary: Pick<Summary, 'kritiekPunt' | 'takeaways'>,
    opts: SpeakOptions,
    from?: SpeechId,
  ): Promise<void> {
    const items = buildSpeechItems(summary);
    const start =
      from === undefined
        ? 0
        : Math.max(
            0,
            items.findIndex((i) => i.id === from),
          );
    await this.speakItems(items.slice(start), opts);
  }

  /** One item only, e.g. the evidence for a takeaway. */
  speakItem(item: SpeechItem, opts: SpeakOptions): Promise<void> {
    return this.speakItems([item], opts);
  }

  private async speakItems(items: SpeechItem[], opts: SpeakOptions): Promise<void> {
    const run = ++this.run;
    void this.tts.stop().catch(() => undefined);
    try {
      for (const item of items) {
        if (run !== this.run) return;
        this.set(item.id);
        for (const part of splitForSpeech(item.text)) {
          if (run !== this.run) return;
          await this.speakText(part, opts);
        }
      }
    } finally {
      if (run === this.run) this.set(null);
    }
  }

  stop(): void {
    this.run++;
    void this.tts.stop().catch(() => undefined);
    this.set(null);
  }

  private set(id: SpeechId | null): void {
    this.speakingId = id;
    this.onChange();
  }
}
