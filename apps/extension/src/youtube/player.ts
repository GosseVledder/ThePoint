import { SEL } from './selectors';

export function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>(SEL.video);
}

/** Jump to a moment in the current video and keep playing. */
export function seekTo(seconds: number): boolean {
  const video = getVideo();
  if (!video) return false;
  video.currentTime = Math.max(0, seconds);
  if (video.paused) void video.play().catch(() => undefined);
  return true;
}

export function pause(): void {
  getVideo()?.pause();
}

export function play(): void {
  void getVideo()
    ?.play()
    .catch(() => undefined);
}

/**
 * Keep the video paused until `release()` is called. YouTube restarts playback on
 * its own (autoplay, after ads), so every `play` event is answered with a pause.
 */
export function holdPlayback(): { release: () => void } {
  let video: HTMLVideoElement | null = null;
  let released = false;
  const onPlay = (e: Event) => (e.target as HTMLVideoElement).pause();
  const attach = () => {
    if (released) return;
    const v = getVideo();
    if (v && v !== video) {
      video?.removeEventListener('play', onPlay);
      video = v;
      video.addEventListener('play', onPlay);
      if (!video.paused) video.pause();
    }
  };
  attach();
  const timer = window.setInterval(attach, 500);
  return {
    release() {
      if (released) return;
      released = true;
      window.clearInterval(timer);
      video?.removeEventListener('play', onPlay);
    },
  };
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}
