// Summary screen: the YouTube player on top (optional, off by default), the shared
// summary view below.
import type { Summary } from '@the-point/core/engine/types';
import { runSummaryJob, toErrorInfo, type JobEvent } from '@the-point/core/job';
import { renderView, h, type ViewState } from '@the-point/core/ui/render';
import { buildEvidenceSpeech, type SpeechId, type SpeechItem } from '@the-point/core/ui/speechText';
import { BASE_CSS } from '@the-point/core/ui/styles';
import type { Settings } from '@the-point/core/settings';
import { getTranscriptById } from '@the-point/core/youtube/transcript';
import { isDark, type App, type Screen } from '../app';
import { nativeFetch } from '../nativeFetch';
import { createPlayer, youtubeAppUrl, type EmbeddedPlayer } from '../player';

const VIEW_CSS = `
.root { padding: 12px 16px 32px; }
`;

export function summaryScreen(app: App, videoId: string, start: number | null): Screen {
  const playerBox = h('div', { class: 'player', hidden: true });
  const host = h('div', { class: 'summary-host' });
  // The summary lives in a shadow root, so it follows the system theme itself.
  const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const applyTheme = () => (host.dataset.theme = isDark() ? 'dark' : 'light');
  applyTheme();
  darkQuery?.addEventListener('change', applyTheme);
  const shadow = host.attachShadow({ mode: 'open' });
  const root = h('div', { class: 'root' });
  shadow.append(h('style', {}, BASE_CSS + VIEW_CSS), root);
  const el = h('div', { class: 'screen summary' }, playerBox, host);

  let state: ViewState = { kind: 'loading', stap: 'cache' };
  let settings: Settings | null = null;
  let run = 0;
  let disposed = false;

  // Player: only while the title-bar toggle is on (also switched on by "Toon player"
  // in the seek dialog). Embedded, or the YouTube app when the video may not be
  // embedded. Turning it off removes the iframe, so nothing plays out of sight.
  let player: Promise<EmbeddedPlayer> | null = null;
  let ready: EmbeddedPlayer | null = null;
  let playerFailed = false;
  let playerGen = 0;
  const openInYouTube = (sec: number) => (window.location.href = youtubeAppUrl(videoId, sec));
  const showPlayer = (at: number | null): Promise<EmbeddedPlayer> => {
    if (player) return player;
    const gen = ++playerGen;
    playerBox.hidden = false;
    player = createPlayer(playerBox, videoId, {
      start: at,
      onError: (code) => {
        if (gen !== playerGen) return;
        playerFailed = true;
        playerBox.replaceChildren(
          h(
            'div',
            { class: 'player-fallback' },
            h('p', {}, `De video kan hier niet worden afgespeeld (fout ${code}).`),
            h('button', { onClick: () => openInYouTube(at ?? 0) }, 'Open in YouTube'),
          ),
        );
        render();
      },
    });
    void player.then((p) => {
      if (gen === playerGen) ready = p;
    });
    return player;
  };
  const hidePlayer = () => {
    playerGen++;
    ready?.pause();
    playerBox.replaceChildren();
    playerBox.hidden = true;
    player = null;
    ready = null;
    if (playerFailed) {
      playerFailed = false;
      render();
    }
  };
  if (app.playerOn) void showPlayer(start);

  // The video and reading aloud never play at the same time.
  const playAt = (sec: number) => {
    app.speaker.stop();
    if (!app.playerOn) app.setPlayerOn(true);
    const gen = playerGen;
    void showPlayer(sec).then((p) => gen === playerGen && p.seekTo(sec));
  };
  const seek = (sec: number, id: SpeechId) => {
    if (playerFailed) openInYouTube(sec);
    else if (player) playAt(sec);
    else askSeek(sec, id);
  };

  // Without a player, a time stamp asks what to do: show the player, or only hear the
  // evidence read aloud. Playing the video's own audio without a visible player is not
  // allowed by YouTube's API policies, so the evidence is the quote from the transcript.
  let dialog: HTMLElement | null = null;
  const closeDialog = () => {
    dialog?.remove();
    dialog = null;
  };
  function askSeek(sec: number, id: SpeechId) {
    closeDialog();
    const summary = state.kind === 'done' ? state.summary : null;
    const tijd =
      (id === 'kritiek' ? summary?.kritiekPunt.tijd : summary?.takeaways[id]?.tijd) ?? null;
    const evidence = summary ? buildEvidenceSpeech(summary, id) : null;
    const backdrop: HTMLElement = h(
      'div',
      {
        class: 'dialog-backdrop',
        onClick: (e: Event) => e.target === backdrop && closeDialog(),
      },
      h(
        'div',
        { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'seek-title' },
        h('h2', { id: 'seek-title' }, tijd ? `Naar ${tijd} in de video` : 'Naar de video'),
        h('p', {}, 'De YouTube-player staat uit.'),
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              closeDialog();
              playAt(sec);
            },
          },
          tijd ? `Toon player en spring naar ${tijd}` : 'Toon player',
        ),
        evidence
          ? h(
              'button',
              {
                onClick: () => {
                  closeDialog();
                  if (summary) speakItem(summary.taal, evidence);
                },
              },
              'Lees de onderbouwing voor',
            )
          : null,
        h('button', { onClick: closeDialog }, 'Annuleren'),
      ),
    );
    dialog = backdrop;
    el.append(backdrop);
    backdrop.querySelector<HTMLButtonElement>('button.primary')?.focus();
  }

  const speakOptions = (s: Settings, taal: string) => ({
    taal,
    rate: s.spreeksnelheid,
    voiceUri: s.stemmen[taal],
  });

  const speak = (summary: Summary, from?: 'kritiek' | number) => {
    if (!settings) return;
    // Like the extension: reading aloud pauses the video.
    ready?.pause();
    void app.speaker.speak(summary, speakOptions(settings, summary.taal), from);
  };

  const speakItem = (taal: string, item: SpeechItem) => {
    if (!settings) return;
    ready?.pause();
    void app.speaker.speakItem(item, speakOptions(settings, taal));
  };

  function render() {
    if (disposed) return;
    const taal = state.kind === 'done' ? state.summary.taal : (settings?.taal ?? 'nl');
    const voice = app.speaker.voiceFor(taal, settings?.stemmen[taal]);
    renderView(
      root,
      state,
      {
        onSeek: seek,
        onStart: () => void summarize(false),
        onRefresh: () => void summarize(true),
        onConfirm: () => void summarize(false, true),
        onOpenOptions: () => app.go('#/instellingen'),
        onSpeak: (from) => state.kind === 'done' && speak(state.summary, from),
        onStopSpeak: () => app.speaker.stop(),
        onVoiceChange: async (voiceUri) => {
          const cur = await app.settings.get();
          settings = await app.settings.save({ stemmen: { ...cur.stemmen, [taal]: voiceUri } });
          render();
        },
      },
      {
        seekLabel: playerFailed ? 'Open op' : 'Spring naar',
        speech: {
          available: true,
          speakingId: app.speaker.speakingId,
          voices: app.speaker.voices,
          voiceUri: voice?.voiceURI ?? null,
          taal,
        },
      },
    );
  }

  async function summarize(forceRefresh: boolean, confirmLong = false) {
    const my = ++run;
    app.speaker.stop();
    const [s, keys] = await Promise.all([app.settings.get(), app.keys.get()]);
    settings = s;
    const emit = (e: JobEvent) => {
      if (my !== run || disposed) return;
      if (e.type === 'progress')
        state = {
          kind: 'loading',
          stap: e.stap,
          provider: e.provider,
          deel: e.deel,
          delen: e.delen,
        };
      else if (e.type === 'done')
        state = { kind: 'done', summary: e.summary, fromCache: e.fromCache };
      else if (e.type === 'error') state = { kind: 'error', error: e.error };
      else state = { kind: 'confirm', minuten: e.minuten };
      render();
    };
    try {
      await runSummaryJob(
        { videoId, forceRefresh, confirmLong, paginaGeprobeerd: true },
        {
          settings: s,
          keys,
          getCached: app.cache.get,
          setCached: app.cache.set,
          getTranscript: (v) => getTranscriptById(v, { fetch: nativeFetch }),
          fetch: nativeFetch,
        },
        emit,
      );
    } catch (e) {
      emit({ type: 'error', error: toErrorInfo(e) });
    }
  }

  render();
  void summarize(false);

  return {
    title: 'Samenvatting',
    el,
    refresh: render,
    setPlayer(on) {
      if (on) void showPlayer(null);
      else hidePlayer();
    },
    back() {
      if (!dialog) return false;
      closeDialog();
      return true;
    },
    dispose() {
      disposed = true;
      closeDialog();
      darkQuery?.removeEventListener('change', applyTheme);
      run++;
      app.speaker.stop();
    },
  };
}
