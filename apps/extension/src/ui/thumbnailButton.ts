import { SEL } from '../youtube/selectors';
import { parseVideoId } from '@the-point/core/youtube/videoId';
import { createShadowUi, type ShadowUi } from './host';
import { Popover } from './popover';
import { ICONS } from '@the-point/core/ui/styles';

const BUTTON_CSS = `
:host { position: fixed; z-index: 2200; display: block; }
button { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px 0 8px; border: 0; border-radius: 14px;
  background: rgba(15, 15, 15, .85); color: #fff; font: 500 12px/1 "Roboto", "Arial", sans-serif; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
button:hover { background: rgba(15, 15, 15, .95); }
button svg { width: 16px; height: 16px; fill: currentColor; }
button.cached svg { fill: #ffcc00; }
`;

const BADGE_CSS = `
:host { position: absolute; top: 6px; left: 6px; z-index: 3; pointer-events: none; display: block; }
span { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 50%; background: rgba(15,15,15,.8); }
svg { width: 14px; height: 14px; fill: #ffcc00; }
`;

const BADGE_ATTR = 'data-the-point-badge';

function videoIdOf(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute('href');
  return href && href.includes('/watch?v=') ? parseVideoId(href) : null;
}

/**
 * "Samenvat" button on thumbnails (home, search, sidebar) and a small badge on
 * thumbnails that already have a cached summary.
 */
export class ThumbnailButtons {
  private button: ShadowUi;
  private popover = new Popover();
  private current: { anchor: HTMLAnchorElement; videoId: string } | null = null;
  private cached = new Set<string>();
  private observer: MutationObserver;
  private scanTimer: number | undefined;
  private cleanups: (() => void)[] = [];

  constructor() {
    this.button = createShadowUi({ css: BUTTON_CSS, forceTheme: 'dark' });
    this.button.host.id = 'the-point-thumb-button';
    this.button.host.style.display = 'none';
    const btn = document.createElement('button');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.current) this.popover.open(this.current.anchor, this.current.videoId);
    });
    btn.addEventListener('mouseleave', (e) => this.onLeave(e));
    this.button.root.append(btn);
    document.body.append(this.button.host);

    const onOver = (e: MouseEvent) => this.onOver(e);
    const onOut = (e: MouseEvent) => this.onLeave(e);
    // Follow the thumbnail while the page scrolls (YouTube also fires scroll events in
    // inner elements, e.g. the hover preview); hide once the pointer has left it.
    const onScroll = () => this.followOrHide();
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    this.cleanups.push(() => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('scroll', onScroll, true);
    });

    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  setCached(ids: Iterable<string>): void {
    this.cached = new Set(ids);
    this.scheduleScan(0);
  }

  private onOver(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!target || target === this.button.host) return;
    const anchor = target.closest<HTMLAnchorElement>(SEL.thumbnailAnchor);
    if (!anchor) return;
    const videoId = videoIdOf(anchor);
    if (!videoId) return;
    if (this.current?.anchor === anchor && this.button.host.style.display !== 'none') return;
    this.current = { anchor, videoId };
    this.show();
  }

  private onLeave(e: MouseEvent): void {
    const to = e.relatedTarget as Node | null;
    if (!this.current) return;
    if (to && (to === this.button.host || this.current.anchor.contains(to))) return;
    this.hide();
  }

  private show(): void {
    if (!this.current) return;
    const r = this.current.anchor.getBoundingClientRect();
    if (r.width < 120 || r.height < 60) return; // tiny thumbnails (e.g. playlists) are skipped
    const btn = this.button.root.querySelector('button')!;
    const isCached = this.cached.has(this.current.videoId);
    btn.className = isCached ? 'cached' : '';
    btn.innerHTML = ICONS.logo;
    btn.append(isCached ? 'Samenvatting' : 'Samenvat');
    btn.title = isCached ? 'Bekijk de AI-samenvatting' : 'Maak een AI-samenvatting van deze video';
    Object.assign(this.button.host.style, {
      display: 'block',
      left: `${Math.round(r.left + 8)}px`,
      top: `${Math.round(r.top + 8)}px`,
    });
  }

  private followOrHide(): void {
    if (this.button.host.style.display === 'none' || !this.current) return;
    const { anchor } = this.current;
    if (anchor.isConnected && (anchor.matches(':hover') || this.button.host.matches(':hover')))
      this.show();
    else this.hide();
  }

  private hide(): void {
    this.button.host.style.display = 'none';
  }

  private scheduleScan(delay = 400): void {
    if (this.scanTimer !== undefined) return;
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = undefined;
      const run = () => this.scanBadges();
      if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1000 });
      else run();
    }, delay);
  }

  /** Add or remove the "already summarized" badge. YouTube recycles elements, so check every time. */
  private scanBadges(): void {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(SEL.thumbnailAnchor);
    anchors.forEach((anchor) => {
      const id = videoIdOf(anchor);
      const want = !!id && this.cached.has(id);
      const existing = anchor.querySelector<HTMLElement>(`:scope > the-point-root[${BADGE_ATTR}]`);
      if (want && !existing) {
        const ui = createShadowUi({ css: BADGE_CSS, forceTheme: 'dark' });
        ui.host.setAttribute(BADGE_ATTR, '');
        ui.host.title = 'Samenvatting beschikbaar';
        const span = document.createElement('span');
        span.innerHTML = ICONS.logo;
        ui.root.append(span);
        if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
        anchor.append(ui.host);
      } else if (!want && existing) {
        existing.remove();
      }
    });
  }

  closePopover(): void {
    this.popover.close();
    this.hide();
  }

  destroy(): void {
    this.cleanups.forEach((c) => c());
    this.observer.disconnect();
    window.clearTimeout(this.scanTimer);
    this.popover.close();
    this.button.remove();
    document.querySelectorAll(`the-point-root[${BADGE_ATTR}]`).forEach((b) => b.remove());
  }
}
