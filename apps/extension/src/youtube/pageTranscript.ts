import type { Transcript, TranscriptSegment, VideoMeta } from '@the-point/core/engine/types';
import { parseTime } from '@the-point/core/engine/prompt';
import { SEL } from './selectors';

/**
 * Strategy 2: read YouTube's own transcript panel on the watch page.
 * Only used when strategy 1 (caption tracks by video ID) found nothing.
 * Opens the panel if needed, reads all segments and closes it again.
 */
export async function readTranscriptPanel(
  videoId: string,
  timeoutMs = 10_000,
): Promise<Transcript | null> {
  // The panel belongs to the video the page currently shows.
  if (document.querySelector(SEL.watchFlexy)?.getAttribute('video-id') !== videoId) return null;
  let segments = readSegments();
  let opened = false;
  if (segments.length === 0) {
    const button = await findTranscriptButton();
    if (!button) return null;
    button.click();
    opened = true;
    segments =
      (await waitFor(() => {
        const s = readSegments();
        return s.length > 0 ? s : null;
      }, timeoutMs)) ?? [];
  }
  if (opened) closePanel();
  if (segments.length === 0) return null;
  return {
    videoId,
    taal: document.documentElement.lang || 'und',
    soort: 'automatisch',
    segmenten: segments,
  };
}

function readSegments(): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const push = (timeText: string | null | undefined, text: string | null | undefined) => {
    const start = parseTime(timeText?.trim() ?? '');
    const tekst = (text ?? '').replace(/\s+/g, ' ').trim();
    if (start !== null && tekst) out.push({ start, duur: 0, tekst });
  };
  document.querySelectorAll(SEL.transcriptSegmentNew).forEach((el) => {
    push(
      el.querySelector(SEL.transcriptSegmentNewTime)?.textContent,
      el.querySelector(SEL.transcriptSegmentNewText)?.textContent,
    );
  });
  if (out.length === 0) {
    document.querySelectorAll(SEL.transcriptSegmentOld).forEach((el) => {
      push(
        el.querySelector(SEL.transcriptSegmentOldTime)?.textContent,
        el.querySelector(SEL.transcriptSegmentOldText)?.textContent,
      );
    });
  }
  // Durations from the next segment's start.
  for (let i = 0; i < out.length - 1; i++)
    out[i]!.duur = Math.max(0, out[i + 1]!.start - out[i]!.start);
  return out;
}

async function findTranscriptButton(): Promise<HTMLElement | null> {
  const visible = () =>
    [...document.querySelectorAll<HTMLElement>(SEL.transcriptButton)].find(
      (b) => b.offsetParent !== null,
    ) ?? null;
  let button = visible();
  if (!button) {
    document.querySelector<HTMLElement>(SEL.descriptionExpand)?.click();
    button = await waitFor(visible, 2_000);
  }
  return button;
}

function closePanel(): void {
  const panel = [...document.querySelectorAll<HTMLElement>(SEL.engagementPanelExpanded)].find(
    (p) => p.querySelector(SEL.transcriptSegmentNew) || p.querySelector(SEL.transcriptSegmentOld),
  );
  panel?.querySelector<HTMLElement>(SEL.engagementPanelClose)?.click();
}

function waitFor<T>(fn: () => T | null, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const v = fn();
      if (v) return resolve(v);
      if (Date.now() - started > timeoutMs) return resolve(null);
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

/** Title, channel and duration of the video the watch page shows (empty when unknown). */
export function readPageMeta(videoId: string): Partial<VideoMeta> {
  if (document.querySelector(SEL.watchFlexy)?.getAttribute('video-id') !== videoId) return {};
  const titel = document.querySelector(SEL.watchTitle)?.textContent?.trim() ?? '';
  const kanaal = document.querySelector(SEL.watchChannel)?.textContent?.trim() ?? '';
  const duration = document.querySelector<HTMLVideoElement>(SEL.video)?.duration;
  const isAd = document.querySelector(SEL.player)?.classList.contains('ad-showing');
  return {
    titel,
    kanaal,
    duurSeconden: !isAd && duration && Number.isFinite(duration) ? Math.round(duration) : 0,
  };
}
