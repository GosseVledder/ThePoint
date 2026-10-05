import { SEL } from '../youtube/selectors';
import { BASE_CSS } from '@yt-ai/core/ui/styles';

export interface ShadowUi {
  host: HTMLElement;
  shadow: ShadowRoot;
  /** Container inside the shadow root to render into. */
  root: HTMLElement;
  remove: () => void;
}

const hosts = new Set<HTMLElement>();

export function currentTheme(): 'dark' | 'light' {
  return document.documentElement.hasAttribute(SEL.darkThemeAttr) ? 'dark' : 'light';
}

/** A custom element host with an open shadow root, so YouTube CSS and ours never mix. */
export function createShadowUi(
  opts: { css?: string; hostStyle?: string; forceTheme?: 'dark' | 'light' } = {},
): ShadowUi {
  const host = document.createElement('yt-ai-root');
  if (opts.hostStyle) host.setAttribute('style', opts.hostStyle);
  host.dataset.theme = opts.forceTheme ?? currentTheme();
  if (opts.forceTheme) host.dataset.forceTheme = opts.forceTheme;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = BASE_CSS + (opts.css ?? '');
  const root = document.createElement('div');
  root.className = 'root';
  shadow.append(style, root);
  // Hosts with a fixed theme never need updates; not tracking them avoids leaks
  // when YouTube removes recycled thumbnails that carry a badge.
  if (!opts.forceTheme) hosts.add(host);
  return {
    host,
    shadow,
    root,
    remove: () => {
      hosts.delete(host);
      host.remove();
    },
  };
}

/** Keep every host in sync with YouTube's light/dark theme. */
export function watchTheme(): () => void {
  const apply = () => {
    const theme = currentTheme();
    hosts.forEach((h) => {
      if (!h.dataset.forceTheme) h.dataset.theme = theme;
    });
  };
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [SEL.darkThemeAttr],
  });
  return () => observer.disconnect();
}

/** Resolve when `selector` matches, or null after `timeoutMs`. */
export function waitForElement<T extends Element = HTMLElement>(
  selector: string,
  timeoutMs = 15_000,
): Promise<T | null> {
  const found = document.querySelector<T>(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        observer.disconnect();
        window.clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector<T>(selector));
    }, timeoutMs);
  });
}

/** Stop events inside our UI from reaching YouTube's own handlers (player shortcuts, clicks). */
export function isolateEvents(el: HTMLElement, types: string[]): void {
  for (const t of types) el.addEventListener(t, (e) => e.stopPropagation());
}
