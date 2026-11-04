// App shell: hash routing between home, summary and settings, plus incoming shares.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { App as CapApp } from '@capacitor/app';
import { messages } from '@the-point/core/i18n/messages';
import { ICONS } from '@the-point/core/ui/styles';
import { NavStack, parseRoute, summaryHash, welcomeHash, type App, type Screen } from './app';
import './app.css';
import { homeScreen } from './screens/home';
import { welcomeScreen } from './screens/onboarding';
import { settingsScreen } from './screens/settings';
import { summaryScreen } from './screens/summary';
import { videoFromShare } from './share';
import { onShare } from './shareIntent';
import { Speaker } from './speech';
import { filesKV, preferencesKV, secureKV } from './storage/native';
import {
  createKeyStore,
  createSettingsStore,
  createSummaryCache,
  moveSummaries,
} from './storage/stores';

const $ = (id: string) => document.getElementById(id)!;
const screenEl = $('screen');
const titleEl = $('title');
const backBtn = $('back') as HTMLButtonElement;
const settingsBtn = $('open-settings') as HTMLButtonElement;
const playerBtn = $('toggle-player') as HTMLButtonElement;
const toastEl = $('toast');

let current: Screen | null = null;
const nav = new NavStack();
let toastTimer: number | undefined;

const app: App = {
  settings: createSettingsStore(preferencesKV),
  keys: createKeyStore(secureKV),
  cache: createSummaryCache(filesKV),
  speaker: new Speaker(TextToSpeech, () => current?.refresh?.()),
  go(hash) {
    nav.push(hash);
    show();
  },
  back() {
    if (current?.back?.()) return;
    if (nav.back()) show();
    else void CapApp.exitApp().catch(() => undefined);
  },
  playerOn: false,
  setPlayerOn(on) {
    app.playerOn = on;
    updatePlayerButton();
    current?.setPlayer?.(on);
  },
  t: messages('nl'),
  setLanguage(lang) {
    app.t = messages(lang);
    applyChrome();
    show();
  },
  toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), 4000);
  },
};

/** Show the screen on top of the stack; the hash only mirrors it (no browser history). */
function show() {
  const r = parseRoute(nav.current);
  if (r.name === 'summary' && r.refresh) {
    nav.replace(summaryHash(r.videoId, r.start));
  }
  history.replaceState(null, '', nav.current);
  current?.dispose?.();
  current =
    r.name === 'summary'
      ? summaryScreen(app, r.videoId, r.start, r.refresh)
      : r.name === 'settings'
        ? settingsScreen(app)
        : r.name === 'welcome'
          ? welcomeScreen(app, r.videoId)
          : homeScreen(app);
  titleEl.textContent = current.title;
  backBtn.hidden = r.name === 'home';
  settingsBtn.hidden = r.name === 'settings';
  playerBtn.hidden = !current.setPlayer;
  updatePlayerButton();
  screenEl.replaceChildren(current.el);
  window.scrollTo(0, 0);
}

backBtn.innerHTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>';
settingsBtn.innerHTML = ICONS.settings;
function updatePlayerButton() {
  const label = app.playerOn ? app.t.app.hidePlayer : app.t.app.showPlayer;
  playerBtn.setAttribute('aria-pressed', String(app.playerOn));
  playerBtn.setAttribute('aria-label', label);
  playerBtn.title = label;
}

/** Title-bar labels and the page language. */
function applyChrome() {
  document.documentElement.lang = app.t.locale.split('-')[0]!;
  backBtn.setAttribute('aria-label', app.t.app.back);
  settingsBtn.setAttribute('aria-label', app.t.app.settings);
  updatePlayerButton();
}

// "Smart display": a play triangle in a screen.
playerBtn.innerHTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9.5 16.5v-9l7 4.5-7 4.5z"/></svg>';
playerBtn.onclick = () => app.setPlayerOn(!app.playerOn);
backBtn.onclick = () => app.back();
settingsBtn.onclick = () => app.go('#/instellingen');

// With a listener, Capacitor leaves Android's back button to us.
void CapApp.addListener('backButton', () => app.back()).catch(() => undefined);
onShare((e) => {
  const v = videoFromShare(e.text) ?? videoFromShare(e.subject);
  if (v) {
    nav.reset(summaryHash(v.videoId, v.start));
    show();
  } else app.toast(app.t.app.shareNoVideo);
});
void app.speaker.loadVoices().then(() => current?.refresh?.());
/** Set once the guide opened by itself, so it does so only on the first start. */
const WELCOME_SHOWN = 'welcomeShown';

/** First start without a key (and not opened by a share): the setup guide, home below it. */
async function firstStart(): Promise<string | null> {
  // Summaries from before 0.7.0 lived in Preferences; move them to files once.
  await moveSummaries(preferencesKV, filesKV).catch(() => 0);
  const [s, keys, shown] = await Promise.all([
    app.settings.get(),
    app.keys.get(),
    preferencesKV.get(WELCOME_SHOWN),
  ]);
  app.t = messages(s.interfaceTaal);
  if (shown || keys[s.provider]) return null;
  await preferencesKV.set(WELCOME_SHOWN, '1');
  return welcomeHash();
}

void firstStart()
  .catch(() => null)
  .then((welcome) => {
    applyChrome();
    const start = location.hash || '#/';
    nav.reset(welcome && parseRoute(start).name === 'home' ? welcome : start);
    show();
  });
