import type { Transcript, VideoMeta } from '@the-point/core/engine/types';
import { SUMMARIZE_PORT, type ErrorInfo, type PortEvent, type PortRequest } from '../messages';
import type { ViewState } from '@the-point/core/ui/render';
import { labelFor } from '@the-point/core/engine/refinements';

export interface SessionOptions {
  videoId: string;
  onState: (state: ViewState) => void;
  /** Watch page only: read YouTube's transcript panel when no captions were found. */
  readPageTranscript?: () => Promise<Transcript | null>;
  /** Watch page only: title, channel and duration from the page. */
  pageMeta?: () => Partial<VideoMeta>;
  /** A refinement finished: its id, to show it. */
  onRefined?: (refinementId: string) => void;
}

const KEEPALIVE_MS = 20_000;

/**
 * One summary request for one video, over a long-lived port. The port keeps the
 * background service worker alive during long model calls (pings every 20 s).
 */
export class SummarySession {
  private port: Browser.runtime.Port | null = null;
  private keepalive: number | undefined;
  private refinePort: Browser.runtime.Port | null = null;
  private refineKeepalive: number | undefined;
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
    this.closeRefinePort();
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

  /**
   * Refine the takeaways of the shown summary with one instruction. The summary stays
   * visible; `refining` in the state shows the progress, `refineError` a failure.
   */
  refine(
    instructie: string,
    label?: string,
    extra: { pageTranscript?: Transcript; paginaGeprobeerd?: boolean } = {},
  ): void {
    const current = this.state;
    if (this.disposed || current.kind !== 'done' || !instructie.trim()) return;
    this.closeRefinePort();
    const shownLabel = label?.trim() || labelFor(instructie);
    this.setState({ ...current, refining: { label: shownLabel }, refineError: undefined });
    let port: Browser.runtime.Port;
    try {
      port = browser.runtime.connect({ name: SUMMARIZE_PORT });
    } catch (e) {
      this.refineFailed(extensionReloaded(e));
      return;
    }
    this.refinePort = port;
    let retried = false;
    port.onMessage.addListener(async (msg: PortEvent) => {
      if (this.disposed || this.refinePort !== port) return;
      if (msg.type === 'done') {
        this.closeRefinePort();
        const now = this.state;
        this.setState({
          kind: 'done',
          summary: msg.summary,
          fromCache: now.kind === 'done' ? now.fromCache : true,
        });
        if (msg.refinementId) this.opts.onRefined?.(msg.refinementId);
      } else if (msg.type === 'error') {
        this.closeRefinePort();
        if (
          msg.error.tryPageTranscript &&
          this.opts.readPageTranscript &&
          !extra.paginaGeprobeerd
        ) {
          const transcript = await this.opts.readPageTranscript().catch(() => null);
          if (this.disposed) return;
          if (transcript) {
            this.restoreDone();
            this.refine(instructie, label, { pageTranscript: transcript, paginaGeprobeerd: true });
            return;
          }
        }
        this.refineFailed(msg.error);
      }
    });
    port.onDisconnect.addListener(() => {
      if (this.refinePort !== port) return;
      this.closeRefinePort();
      const now = this.state;
      if (this.disposed || now.kind !== 'done' || !now.refining) return;
      // Service worker restarted mid-request: ask once more.
      if (!retried) {
        retried = true;
        this.restoreDone();
        window.setTimeout(() => this.refine(instructie, label, extra), 500);
      } else {
        this.refineFailed({ code: 'internal', message: 'De verbinding met de extensie viel weg.' });
      }
    });
    const req: PortRequest = {
      type: 'refine',
      videoId: this.opts.videoId,
      instructie,
      label: shownLabel,
      pageMeta: this.opts.pageMeta?.(),
      pageTranscript: extra.pageTranscript,
      paginaGeprobeerd: !this.opts.readPageTranscript || !!extra.paginaGeprobeerd,
    };
    port.postMessage(req);
    this.refineKeepalive = window.setInterval(() => {
      try {
        port.postMessage({ type: 'ping' } satisfies PortRequest);
      } catch {
        window.clearInterval(this.refineKeepalive);
      }
    }, KEEPALIVE_MS);
  }

  private refineFailed(error: ErrorInfo): void {
    const now = this.state;
    if (now.kind !== 'done') return;
    this.setState({ ...now, refining: undefined, refineError: error });
  }

  /** Back to the plain summary view, without refine status. */
  private restoreDone(): void {
    const now = this.state;
    if (now.kind === 'done') this.state = { ...now, refining: undefined, refineError: undefined };
  }

  private closeRefinePort(): void {
    window.clearInterval(this.refineKeepalive);
    const port = this.refinePort;
    this.refinePort = null;
    try {
      port?.disconnect();
    } catch {
      // already closed
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
    this.closeRefinePort();
    this.setState({ kind: 'idle' });
  }

  dispose(): void {
    this.disposed = true;
    this.closePort();
    this.closeRefinePort();
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
