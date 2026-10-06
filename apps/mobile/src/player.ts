// YouTube IFrame Player inside the app's WebView. We create the iframe ourselves so we
// can set a referrer policy: without a referrer YouTube refuses the embed (error 153).

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
}
interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: { events?: { onReady?: () => void; onError?: (e: { data: number }) => void } },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiPromise;
}

export interface EmbeddedPlayer {
  seekTo(seconds: number): void;
  pause(): void;
}

export async function createPlayer(
  container: HTMLElement,
  videoId: string,
  opts: { start?: number | null; onError: (code: number) => void },
): Promise<EmbeddedPlayer> {
  const params = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    origin: location.origin,
  });
  if (opts.start) params.set('start', String(Math.floor(opts.start)));
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?${params}`;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.allowFullscreen = true;
  container.replaceChildren(iframe);

  const YT = await loadApi();
  return new Promise((resolve) => {
    const player = new YT.Player(iframe, {
      events: {
        onReady: () =>
          resolve({
            seekTo: (sec) => {
              player.seekTo(sec, true);
              player.playVideo();
            },
            pause: () => player.pauseVideo(),
          }),
        onError: (e) => opts.onError(e.data),
      },
    });
  });
}

/** Fallback: open the video in the YouTube app (or browser) at a moment. */
export function youtubeAppUrl(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`;
}
