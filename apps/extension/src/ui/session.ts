import type { Transcript, VideoMeta } from '@the-point/core/engine/types';
import { SUMMARIZE_PORT, type PortEvent, type PortRequest } from '../messages';
import type { ViewState } from '@the-point/core/ui/render';

export interface SessionOptions {
  videoId: string;
  onState: (state: ViewState) => void;
  /** Watch page only: read YouTube's transcript panel when no captions were found. */
  readPageTranscript?: () => Promise<Transcript | null>;
  /** Watch page only: title, channel and duration from the page. */
  pageMeta?: () => Partial<VideoMeta>;
}

const KEEPALIVE_MS = 20_000;

/**
 * One summary request for one video, over a long-lived port. The port keeps the
 * background service worker alive during long model calls (pings every 20 s).
 */
export class SummarySession {
  private port: Browser.runtime.Port | null = null;
  private keepalive: number | undefined;
  private disposed = false;
  state: ViewState = { kind: 'idle' };

  constructor(private readonly opts: SessionOptions) {}

  get videoId(): string {
    return this.opts.videoId;
  }

  start(
    extra: {
      forceRefresh?: boolean;
      confirmLong?: boolean;
      pageTranscript?: Transcript;
      paginaGeprobeerd?: boolean;
    } = {},
  ): void {
    if (this.disposed) return;
    this.closePort();
    this.setState({ kind: 'loading', stap: 'cache' });
    let port: Browser.runtime.Port;
    try {
      port = browser.runtime.connect({ name: SUMMARIZE_PORT });
    } catch (e) {
      this.setState({ kind: 'error', error: extensionReloaded(e) });
      return;
    }
    this.port = port;
    port.onMessage.addListener((msg: PortEvent) => this.onEvent(msg, extra));
    port.onDisconnect.addListener(() => {
      if (this.port !== port) return;
      this.port = null;
      window.clearInterval(this.keepalive);
      if (this.state.kind === 'loading' && !this.disposed) {
        // Service worker restarted mid-request: ask again (the cache absorbs duplicates).
        window.setTimeout(() => this.start(extra), 500);
      }
    });
    const req: PortRequest = {
      type: 'start',
      videoId: this.opts.videoId,
      ...extra,
      pageMeta: this.opts.pageMeta?.(),
      paginaGeprobeerd: !this.opts.readPageTranscript || !!extra.paginaGeprobeerd,
    };
    port.postMessage(req);
    this.keepalive = window.setInterval(() => {
      try {
        port.postMessage({ type: 'ping' } satisfies PortRequest);
      } catch {
        window.clearInterval(this.keepalive);
      }
    }, KEEPALIVE_MS);
  }

  private async onEvent(
    msg: PortEvent,
    extra: Parameters<SummarySession['start']>[0],
  ): Promise<void> {
    if (this.disposed) return;
    switch (msg.type) {
      case 'progress':
        this.setState({
          kind: 'loading',
          stap: msg.stap,
          provider: msg.provider,
          deel: msg.deel,
          delen: msg.delen,
        });
        return;
      case 'done':
        this.closePort();
        this.setState({ kind: 'done', summary: msg.summary, fromCache: msg.fromCache });
        return;
      case 'confirm':
        this.closePort();
        this.setState({ kind: 'confirm', minuten: msg.minuten });
        return;
      case 'error': {
        this.closePort();
        if (
          msg.error.tryPageTranscript &&
          this.opts.readPageTranscript &&
          !extra?.paginaGeprobeerd
        ) {
          this.setState({ kind: 'loading', stap: 'transcript' });
          const transcript = await this.opts.readPageTranscript().catch(() => null);
          if (this.disposed) return;
          this.start(
            transcript
              ? { ...extra, pageTranscript: transcript, paginaGeprobeerd: true }
              : { ...extra, paginaGeprobeerd: true },
          );
          return;
        }
        this.setState({ kind: 'error', error: msg.error });
      }
    }
  }

  private setState(state: ViewState): void {
    this.state = state;
    this.opts.onState(state);
  }

  private closePort(): void {
    window.clearInterval(this.keepalive);
    const port = this.port;
    this.port = null;
    try {
      port?.disconnect();
    } catch {
      // already closed
    }
  }

  /** Stop waiting for a running request and go back to idle. */
  stop(): void {
    this.closePort();
    this.setState({ kind: 'idle' });
  }

  dispose(): void {
    this.disposed = true;
    this.closePort();
  }
}

function extensionReloaded(e: unknown) {
  return {
    code: 'extension_reloaded' as const,
    message: 'De extensie is bijgewerkt of opnieuw geladen. Vernieuw de pagina.',
    details: String(e),
  };
}

export function sendRuntime<T>(msg: import('../messages').RuntimeRequest): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}
