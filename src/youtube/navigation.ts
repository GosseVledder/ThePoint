import { EVENTS } from './selectors';
import { parseVideoId } from './videoId';

export interface PageState {
  url: string;
  /** Video ID when on a watch page, else null. */
  videoId: string | null;
}

export function currentPage(): PageState {
  const url = location.href;
  const onWatch = location.pathname === '/watch';
  return { url, videoId: onWatch ? parseVideoId(url) : null };
}

/**
 * Calls `cb` after every navigation in YouTube's single-page app. Uses YouTube's own
 * `yt-navigate-finish` event, with a URL watcher as fallback for missed events.
 * The callback only fires when the URL actually changed. Returns an unsubscribe.
 */
export function onNavigate(cb: (state: PageState) => void): () => void {
  let lastUrl = '';
  const check = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    cb(currentPage());
  };
  const onFinish = () => check();
  document.addEventListener(EVENTS.navigateFinish, onFinish);
  window.addEventListener('popstate', onFinish);
  // Fallback: YouTube updates <title> on every navigation.
  const observer = new MutationObserver(() => check());
  const title = document.querySelector('head > title');
  if (title) observer.observe(title, { childList: true });
  const interval = window.setInterval(check, 1000);
  check();
  return () => {
    document.removeEventListener(EVENTS.navigateFinish, onFinish);
    window.removeEventListener('popstate', onFinish);
    observer.disconnect();
    window.clearInterval(interval);
  };
}
