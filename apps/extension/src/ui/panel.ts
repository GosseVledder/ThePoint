import type { Summary } from '@the-point/core/engine/types';
import { saveSettings, type Settings } from '../storage/settings';
import { readPageMeta, readTranscriptPanel } from '../youtube/pageTranscript';
import { holdPlayback, isFullscreen, pause, seekTo } from '../youtube/player';
import { SEL } from '../youtube/selectors';
import { createShadowUi, isolateEvents, waitForElement, type ShadowUi } from './host';
import { renderView, type SpeechView, type ViewHandlers } from '@the-point/core/ui/render';
import { sendRuntime, SummarySession } from './session';
import { SpeechControl } from './speech';
import { ICONS } from '@the-point/core/ui/styles';
import { messages, type Messages } from '@the-point/core/i18n/messages';

const PANEL_CSS = `
:host { display: block; }
:host([data-place="secondary"]) { margin: 0 0 16px; }
:host([data-place="below"]) { margin: 12px 0 4px; }
`;

const OVERLAY_CSS = `
:host { position: absolute; top: 16px; right: 16px; width: min(440px, 42%); max-height: calc(100% - 120px); z-index: 70; display: block; }
.root { max-height: inherit; overflow: auto; border-radius: 12px; box-shadow: var(--yt-shadow); background: var(--yt-bg); }
.card { background: transparent; }
`;

const MARKERS_CSS = `
:host { position: absolute; inset: 0; pointer-events: none; z-index: 40; display: block; }
.root { position: absolute; inset: 0; }
.mark { position: absolute; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: var(--yt-mark); box-shadow: 0 0 0 1px rgba(0,0,0,.6); }
.mark.kritiek { width: 8px; height: 8px; margin: -4px 0 0 -4px; background: #fff; }
`;

const BUTTON_CSS = `
:host { display: inline-flex; height: 100%; align-items: center; }
.root { display: inline-flex; height: 100%; align-items: center; }
button { background: transparent; border: 0; padding: 0; width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; opacity: .9; }
button:hover { opacity: 1; background: rgba(255,255,255,.12); }
button svg { width: 24px; height: 24px; fill: currentColor; filter: drop-shadow(0 0 2px rgba(0,0,0,.5)); }
button[aria-pressed="true"] { color: var(--yt-mark); }
`;

/**
 * The summary panel on a watch page, plus its player integrations:
 * takeaway markers on the progress bar and a player button that shows the summary
 * as an overlay in fullscreen.
 */
export class WatchPanel {
  private ui: ShadowUi | null = null;
  private overlay: ShadowUi | null = null;
  private markers: ShadowUi | null = null;
  private playerButton: ShadowUi | null = null;
  private session: SummarySession;
  private speech: SpeechControl;
  private gate: { release: () => void } | null = null;
  private collapsed: boolean;
  private observers: MutationObserver[] = [];
  private cleanups: (() => void)[] = [];
  private destroyed = false;

  constructor(
    readonly videoId: string,
    private settings: Settings,
  ) {
    this.collapsed = settings.paneelIngeklapt;
    this.session = new SummarySession({
      videoId,
      onState: () => this.render(),
      readPageTranscript: () => readTranscriptPanel(videoId),
      pageMeta: () => readPageMeta(videoId),
    });
    // Reading aloud pauses the video (and lifts the autoplay gate).
    this.speech = new SpeechControl(
      () => this.render(),
      () => {
        this.releaseGate();
        pause();
      },
    );
  }

  async mount(): Promise<void> {
    const anchor = await waitForElement(`${SEL.secondaryInner}, ${SEL.below}`);
    if (this.destroyed || !anchor) return;
    this.ui = createShadowUi({ css: PANEL_CSS });
    this.ui.host.id = 'the-point-panel';
    // Keys typed in our panel (space on a button, arrows in the voice menu) must not
    // trigger YouTube's player shortcuts.
    isolateEvents(this.ui.host, ['keydown', 'keyup', 'keypress']);
    void this.speech.init();
    this.place();
    this.watchLayout();
    this.render();

    if (this.settings.actief && this.settings.autoplayPauzeren) {
      const cached = await sendRuntime<Summary | null>({
        type: 'getCached',
        videoId: this.videoId,
      }).catch(() => null);
      if (!cached && !this.destroyed) this.gate = holdPlayback();
    }
    if (this.destroyed) return;
    if (this.settings.actief && this.settings.automatisch) this.session.start();
    else this.render();
    void this.mountPlayerButton();
  }

  updateSettings(settings: Settings): void {
    const markersChanged = settings.markeringen !== this.settings.markeringen;
    const enabledChanged = settings.actief !== this.settings.actief;
    const languageChanged = settings.interfaceTaal !== this.settings.interfaceTaal;
    this.settings = settings;
    if (enabledChanged) this.applyEnabled();
    else if (languageChanged) this.render();
    else if (markersChanged) this.renderMarkers();
  }

  /** Switched off: stop everything. Switched on: summarize this video. */
  private applyEnabled(): void {
    if (this.settings.actief) {
      this.session.start();
    } else {
      this.speech.stop();
      this.releaseGate();
      this.hideOverlay();
      this.session.stop();
    }
    this.render();
  }

  /** Two columns: top of the right column. One column: right under the player. */
  private place(): void {
    if (!this.ui) return;
    const flexy = document.querySelector(SEL.watchFlexy);
    const twoColumns = flexy?.hasAttribute(SEL.twoColumnsAttr) ?? true;
    const target = twoColumns
      ? (document.querySelector(SEL.secondaryInner) ?? document.querySelector(SEL.secondary))
      : document.querySelector(SEL.below);
    if (!target) return;
    const place = twoColumns ? 'secondary' : 'below';
    if (this.ui.host.parentElement !== target || target.firstElementChild !== this.ui.host) {
      target.prepend(this.ui.host);
    }
    this.ui.host.dataset.place = place;
  }

  private watchLayout(): void {
    const flexy = document.querySelector(SEL.watchFlexy);
    if (flexy) {
      const mo = new MutationObserver(() => this.place());
      mo.observe(flexy, { attributes: true, attributeFilter: [SEL.twoColumnsAttr] });
      this.observers.push(mo);
    }
    // YouTube re-renders the columns now and then; put the panel back if it was removed.
    const keep = window.setInterval(() => {
      if (this.ui && !this.ui.host.isConnected) this.place();
    }, 1000);
    this.cleanups.push(() => window.clearInterval(keep));
    const onFullscreen = () => {
      if (!isFullscreen()) this.hideOverlay();
      this.updatePlayerButton();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    this.cleanups.push(() => document.removeEventListener('fullscreenchange', onFullscreen));
  }

  private handlers(): ViewHandlers {
    return {
      onSeek: (sec) => {
        this.releaseGate();
        seekTo(sec);
      },
      onStart: () => this.session.start(),
      onRefresh: () => {
        this.speech.stop();
        this.session.start({ forceRefresh: true });
      },
      onConfirm: () => this.session.start({ confirmLong: true, paginaGeprobeerd: true }),
      onSpeak: (from) => {
        const summary = this.summary();
        if (summary) this.speech.play(summary, from);
      },
      onStopSpeak: () => {
        this.speech.stop();
        this.render();
      },
      onVoiceChange: (uri) => void this.speech.setVoice(uri),
      onOpenOptions: () => void sendRuntime({ type: 'openOptions' }),
      onToggleCollapse: () => {
        this.collapsed = !this.collapsed;
        void saveSettings({ paneelIngeklapt: this.collapsed });
        this.render();
      },
      onWatchAnyway: () => {
        this.releaseGate();
        this.render();
      },
      onToggleEnabled: (on) => {
        // Applied through onSettingsChanged, so every open YouTube tab follows.
        this.settings = { ...this.settings, actief: on };
        this.applyEnabled();
        void saveSettings({ actief: on });
      },
    };
  }

  private get t(): Messages {
    return messages(this.settings.interfaceTaal);
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.session.state;
    if (state.kind === 'done' || state.kind === 'error' || state.kind === 'confirm')
      this.releaseGate();
    if (this.ui) {
      renderView(this.ui.root, state, this.handlers(), {
        collapsed: this.collapsed,
        gateActive: !!this.gate,
        speech: this.speechView(),
        enabled: this.settings.actief,
        t: this.t,
      });
    }
    if (this.overlay) this.renderOverlay();
    this.renderMarkers();
    this.updatePlayerButton();
  }

  private speechView(): SpeechView {
    return {
      available: this.speech.available,
      speakingId: this.speech.speakingId,
      voices: this.speech.voices,
      voiceUri: this.speech.voiceUri,
      taal: this.settings.taal,
    };
  }

  private releaseGate(): void {
    this.gate?.release();
    this.gate = null;
  }

  private summary(): Summary | null {
    const s = this.session.state;
    return s.kind === 'done' ? s.summary : null;
  }

  // Progress bar markers

  private renderMarkers(): void {
    const summary = this.summary();
    const bar = document.querySelector<HTMLElement>(SEL.progressBar);
    const video = document.querySelector<HTMLVideoElement>(SEL.video);
    const player = document.querySelector(SEL.player);
    if (!summary || !this.settings.markeringen || !bar || !video) {
      this.markers?.remove();
      this.markers = null;
      return;
    }
    if (
      !this.markers ||
      !this.markers.host.isConnected ||
      this.markers.host.parentElement !== bar
    ) {
      this.markers?.remove();
      this.markers = createShadowUi({ css: MARKERS_CSS });
      this.markers.host.id = 'the-point-markers';
      bar.append(this.markers.host);
      const update = () => this.renderMarkers();
      video.addEventListener('durationchange', update);
      this.cleanups.push(() => video.removeEventListener('durationchange', update));
    }
    const duration = video.duration;
    const adShowing = player?.classList.contains('ad-showing');
    if (!Number.isFinite(duration) || duration <= 0 || adShowing) {
      this.markers.root.replaceChildren();
      if (adShowing) window.setTimeout(() => this.renderMarkers(), 2000);
      return;
    }
    const dots: HTMLElement[] = [];
    const add = (sec: number, kritiek: boolean) => {
      if (sec > duration) return;
      const d = document.createElement('div');
      d.className = kritiek ? 'mark kritiek' : 'mark';
      d.style.left = `${(sec / duration) * 100}%`;
      dots.push(d);
    };
    summary.takeaways.forEach((t) => add(t.seconden, false));
    if (summary.kritiekPunt.seconden !== null) add(summary.kritiekPunt.seconden, true);
    this.markers.root.replaceChildren(...dots);
  }

  // Player button + fullscreen overlay

  private async mountPlayerButton(): Promise<void> {
    const controls = await waitForElement(SEL.rightControls, 10_000);
    if (!controls || this.destroyed) return;
    this.playerButton = createShadowUi({ css: BUTTON_CSS, forceTheme: 'dark' });
    this.playerButton.host.id = 'the-point-player-button';
    const button = document.createElement('button');
    button.innerHTML = ICONS.logo;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPlayerButton();
    });
    this.playerButton.root.append(button);
    controls.prepend(this.playerButton.host);
    this.updatePlayerButton();
  }

  private updatePlayerButton(): void {
    const host = this.playerButton?.host;
    const button = this.playerButton?.root.querySelector('button');
    if (!host || !button) return;
    button.setAttribute('aria-pressed', String(!!this.overlay));
    button.setAttribute('aria-label', this.t.extension.playerButton);
    button.title = this.t.extension.playerButton;
    host.style.display = this.settings.actief ? '' : 'none';
    if (this.playerButton && !this.playerButton.host.isConnected) {
      document.querySelector(SEL.rightControls)?.prepend(this.playerButton.host);
    }
  }

  private onPlayerButton(): void {
    if (isFullscreen()) {
      if (this.overlay) this.hideOverlay();
      else this.showOverlay();
      return;
    }
    if (this.collapsed) {
      this.collapsed = false;
      void saveSettings({ paneelIngeklapt: false });
    }
    if (this.session.state.kind === 'idle') this.session.start();
    this.render();
    this.ui?.host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private showOverlay(): void {
    const player = document.querySelector<HTMLElement>(SEL.playerOverlayParent);
    if (!player) return;
    this.overlay = createShadowUi({ css: OVERLAY_CSS, forceTheme: 'dark' });
    this.overlay.host.id = 'the-point-overlay';
    isolateEvents(this.overlay.host, [
      'click',
      'dblclick',
      'mousedown',
      'mouseup',
      'wheel',
      'keydown',
      'contextmenu',
    ]);
    player.append(this.overlay.host);
    if (this.session.state.kind === 'idle') this.session.start();
    this.renderOverlay();
    this.updatePlayerButton();
  }

  private renderOverlay(): void {
    if (!this.overlay) return;
    renderView(
      this.overlay.root,
      this.session.state,
      {
        ...this.handlers(),
        onToggleCollapse: undefined,
        onClose: () => this.hideOverlay(),
      },
      { speech: this.speechView(), t: this.t },
    );
  }

  private hideOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.updatePlayerButton();
  }

  destroy(): void {
    this.destroyed = true;
    this.releaseGate();
    this.session.dispose();
    this.speech.dispose();
    this.observers.forEach((o) => o.disconnect());
    this.cleanups.forEach((c) => c());
    this.ui?.remove();
    this.overlay?.remove();
    this.markers?.remove();
    this.playerButton?.remove();
    this.ui = this.overlay = this.markers = this.playerButton = null;
  }
}
