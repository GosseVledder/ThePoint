// Bridge to YouTubeAppPlugin.java: split screen detection and opening a video at a time
// in the YouTube app (next to The Point when the screen is split).
import { registerPlugin } from '@capacitor/core';
import { youtubeAppUrl } from './player';

interface YouTubeAppPlugin {
  isInMultiWindow(): Promise<{ value: boolean }>;
  open(opts: { url: string; adjacent?: boolean }): Promise<{ app: boolean }>;
}

const YouTubeApp = registerPlugin<YouTubeAppPlugin>('YouTubeApp');

/** True when The Point shares the screen with another app (split screen, freeform). */
export async function inSplitScreen(): Promise<boolean> {
  try {
    return (await YouTubeApp.isInMultiWindow()).value;
  } catch {
    return false; // not on Android (vite dev server in a browser)
  }
}

/** Open the video at `seconds` in the YouTube app; in split screen in the other half. */
export async function openInYouTubeApp(
  videoId: string,
  seconds: number,
  adjacent: boolean,
): Promise<void> {
  const url = youtubeAppUrl(videoId, seconds);
  try {
    await YouTubeApp.open({ url, adjacent });
  } catch {
    window.location.href = url;
  }
}
