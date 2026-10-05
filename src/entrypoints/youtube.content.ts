import { cachedVideoIds, parseCacheKey } from '../storage/cache';
import { getSettings, onSettingsChanged, type Settings } from '../storage/settings';
import { watchTheme } from '../ui/host';
import { WatchPanel } from '../ui/panel';
import { ThumbnailButtons } from '../ui/thumbnailButton';
import { onNavigate } from '../youtube/navigation';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    console.log('[yt-ai] geladen');
    let settings: Settings = await getSettings();
    let panel: WatchPanel | null = null;
    const thumbs = new ThumbnailButtons();
    const stopTheme = watchTheme();

    const refreshCached = async () => thumbs.setCached(await cachedVideoIds(settings.taal));
    void refreshCached();

    const stopNav = onNavigate(({ videoId }) => {
      thumbs.closePopover();
      if (panel && panel.videoId === videoId) return;
      panel?.destroy();
      panel = null;
      if (videoId) {
        panel = new WatchPanel(videoId, settings);
        void panel.mount();
      }
    });

    const stopSettings = onSettingsChanged((s) => {
      const languageChanged = s.taal !== settings.taal;
      settings = s;
      panel?.updateSettings(s);
      if (languageChanged) void refreshCached();
    });

    // Keep the "already summarized" badges in sync with the cache.
    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area !== 'local') return;
      if (Object.keys(changes).some((k) => parseCacheKey(k))) void refreshCached();
    };
    browser.storage.onChanged.addListener(onStorage);

    ctx.onInvalidated(() => {
      stopNav();
      stopSettings();
      stopTheme();
      browser.storage.onChanged.removeListener(onStorage);
      panel?.destroy();
      thumbs.destroy();
    });
  },
});
