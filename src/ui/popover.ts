import { watchUrl } from '../youtube/videoId';
import { createShadowUi, isolateEvents, type ShadowUi } from './host';
import { renderView } from './render';
import { sendRuntime, SummarySession } from './session';
import { SpeechControl } from './speech';

const POPOVER_CSS = `
:host { position: fixed; z-index: 2300; width: 400px; display: block; }
.root { max-height: inherit; overflow: auto; border-radius: 12px; background: var(--yt-bg); box-shadow: var(--yt-shadow); overscroll-behavior: contain; }
.card { background: transparent; }
`;

const WIDTH = 400;
const GAP = 8;

/** Popover next to a thumbnail with the same content as the watch-page panel. */
export class Popover {
  private ui: ShadowUi | null = null;
  private session: SummarySession | null = null;
  private speech: SpeechControl | null = null;
  private anchor: HTMLElement | null = null;
  private cleanups: (() => void)[] = [];

  get openFor(): string | null {
    return this.session?.videoId ?? null;
  }

  open(anchor: HTMLElement, videoId: string): void {
    if (this.openFor === videoId && this.anchor === anchor) {
      this.close();
      return;
    }
    this.close();
    this.anchor = anchor;
    this.ui = createShadowUi({ css: POPOVER_CSS });
    this.ui.host.id = 'yt-ai-popover';
    this.ui.host.setAttribute('role', 'dialog');
    this.ui.host.setAttribute('aria-label', 'AI-samenvatting');
    // Keep YouTube from treating clicks and keys inside the popover as its own.
    isolateEvents(this.ui.host, ['click', 'mousedown', 'keydown', 'wheel']);
    document.body.append(this.ui.host);

    const session = new SummarySession({ videoId, onState: () => this.render() });
    this.session = session;
    this.speech = new SpeechControl(() => this.render());
    void this.speech.init();

    this.render();
    this.position();
    session.start();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!this.ui) return;
      const path = e.composedPath();
      if (!path.includes(this.ui.host)) this.close();
    };
    const onScroll = () => this.position();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    this.cleanups.push(() => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    });
  }

  private render(): void {
    if (!this.ui || !this.session) return;
    const videoId = this.session.videoId;
    const session = this.session;
    renderView(
      this.ui.root,
      session.state,
      {
        onSeek: (sec) => location.assign(watchUrl(videoId, sec)),
        onStart: () => session.start(),
        onRefresh: () => {
          this.speech?.stop();
          session.start({ forceRefresh: true });
        },
        onConfirm: () => session.start({ confirmLong: true }),
        onOpenOptions: () => void sendRuntime({ type: 'openOptions' }),
        onClose: () => this.close(),
        onSpeak: (from) => {
          if (session.state.kind === 'done') this.speech?.play(session.state.summary, from);
        },
        onStopSpeak: () => {
          this.speech?.stop();
          this.render();
        },
        onVoiceChange: (uri) => void this.speech?.setVoice(uri),
      },
      {
        seekLabel: 'Open de video op',
        speech: this.speech
          ? {
              available: this.speech.available,
              speakingId: this.speech.speakingId,
              voices: this.speech.voices,
              voiceUri: this.speech.voiceUri,
              taal: this.speech.taal,
            }
          : undefined,
      },
    );
    this.position();
  }

  /** Right of the thumbnail if there is room, else left, else below; always inside the viewport. */
  private position(): void {
    if (!this.ui || !this.anchor) return;
    if (!this.anchor.isConnected) {
      this.close();
      return;
    }
    const r = this.anchor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
      this.close();
      return;
    }
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - 2 * GAP);
    let left: number;
    let top: number;
    if (r.right + GAP + width <= vw - GAP) {
      left = r.right + GAP;
      top = r.top;
    } else if (r.left - GAP - width >= GAP) {
      left = r.left - GAP - width;
      top = r.top;
    } else {
      left = Math.min(Math.max(GAP, r.left), vw - width - GAP);
      top = r.bottom + GAP;
    }
    const maxHeight = Math.min(600, vh - 2 * GAP);
    top = Math.min(
      Math.max(GAP, top),
      vh - GAP - Math.min(maxHeight, this.ui.root.scrollHeight || maxHeight),
    );
    Object.assign(this.ui.host.style, {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
    });
  }

  close(): void {
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.session?.dispose();
    this.session = null;
    this.speech?.dispose();
    this.speech = null;
    this.ui?.remove();
    this.ui = null;
    this.anchor = null;
  }
}
