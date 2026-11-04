// Setup guide in the app: the extension's three steps (make a key in AI Studio, paste and
// check it, done), for a phone. The key is tested first and only saved when it works;
// Gemini then becomes the service. Opened on the first start without a key, from the
// "no key yet" card and notice, and from the settings. Texts: `onboarding` (+ `.app`).
import { Clipboard } from '@capacitor/clipboard';
import { PROVIDERS } from '@the-point/core/engine/summarize';
import {
  errorMessage,
  UI_LANGUAGE_NAMES,
  UI_LANGUAGES,
  type UiLang,
} from '@the-point/core/i18n/messages';
import { toErrorInfo, type ErrorInfo } from '@the-point/core/job';
import {
  cleanKey,
  keyCheckOutcome,
  LANDING_PAGE,
  looksLikeGeminiKey,
  SAMPLE_VIDEO_ID,
} from '@the-point/core/onboarding';
import { KEY_URLS } from '@the-point/core/ui/keySteps';
import { h } from '@the-point/core/ui/render';
import { summaryHash, type App, type Screen } from '../app';
import { nativeFetch } from '../nativeFetch';

const STEPS = 3;

/** `videoId`: the shared video that had no key yet; step 3 leads back to it. */
export function welcomeScreen(app: App, videoId?: string): Screen {
  const t = app.t;
  const o = t.onboarding;
  const a = o.app;
  let step = 1;
  let disposed = false;

  // Language first: on the very first start the guide may not be in the user's language.
  const language = h(
    'select',
    {
      'aria-label': o.language,
      onChange: async (e: Event) => {
        const lang = (e.target as HTMLSelectElement).value as UiLang;
        await app.settings.save({ interfaceTaal: lang });
        app.setLanguage(lang);
      },
    },
    ...UI_LANGUAGES.map((code) =>
      h(
        'option',
        { value: code, selected: code === t.locale.split('-')[0] },
        UI_LANGUAGE_NAMES[code],
      ),
    ),
  );

  const progressLabel = h('p', { class: 'progress-label', id: 'welcome-progress' });
  const bar = h('span');
  const progressBar = h(
    'div',
    {
      class: 'progress-bar',
      role: 'progressbar',
      'aria-valuemin': '1',
      'aria-valuemax': String(STEPS),
      'aria-labelledby': 'welcome-progress',
    },
    bar,
  );
  const stepNames = o.stepNames.map((name) => h('li', {}, name));

  // Step 1: make the key in AI Studio (opens in the browser).
  const step1 = h(
    'section',
    { class: 'card step' },
    h('h3', { class: 'step-title' }, o.step1Title),
    h('p', { class: 'step-text' }, o.step1Text),
    h(
      'p',
      { class: 'step-cta' },
      h(
        'a',
        {
          class: 'btn primary big',
          href: KEY_URLS.gemini,
          // Coming back from the browser, the user wants to paste: be on step 2 by then.
          onClick: () => window.setTimeout(() => showStep(2), 300),
        },
        o.getKey,
      ),
    ),
    h('ol', { class: 'howto' }, ...a.steps1.map((s) => h('li', {}, s))),
    h('ul', { class: 'reassure' }, ...a.reassurance.map((s) => h('li', {}, s))),
    h(
      'div',
      { class: 'step-actions' },
      h('button', { class: 'btn quiet', onClick: () => app.go('#/') }, a.later),
      h('button', { class: 'btn', onClick: () => showStep(2, true) }, o.haveKey),
    ),
  );

  // Step 2: paste, check and save.
  const input = h('input', {
    id: 'welcome-key',
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
    autocapitalize: 'off',
  });
  const toggle: HTMLButtonElement = h(
    'button',
    {
      type: 'button',
      onClick: () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.textContent = show ? o.hide : o.show;
      },
    },
    o.show,
  );
  const warning = h('p', { class: 'hint warn', hidden: true }, o.formatWarning);
  const fallback = h('p', { class: 'hint', hidden: true }, a.pasteFallback);
  const result = h('p', { class: 'check-result', 'aria-live': 'polite' });
  const checkButton = h(
    'button',
    { class: 'btn primary', onClick: () => void check() },
    o.checkSave,
  );
  const setResult = (kind: 'busy' | 'ok' | 'error' | null, text = '') => {
    result.className = kind ? `check-result ${kind}` : 'check-result';
    result.textContent = text;
  };
  /** Gentle hint while typing or after pasting; never blocks saving. */
  const updateWarning = () => {
    const key = cleanKey(input.value);
    warning.hidden = key === '' || looksLikeGeminiKey(key);
  };
  input.addEventListener('input', () => {
    fallback.hidden = true;
    updateWarning();
    if (result.classList.contains('error')) setResult(null);
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void check());

  const paste = async () => {
    try {
      const { value } = await Clipboard.read();
      if (!value?.trim()) throw new Error('empty clipboard');
      input.value = cleanKey(value);
      fallback.hidden = true;
      updateWarning();
    } catch {
      fallback.hidden = false;
      input.focus();
    }
  };

  async function check() {
    const key = cleanKey(input.value);
    input.value = key;
    updateWarning();
    if (!key) {
      setResult('error', o.check.invalid);
      input.focus();
      return;
    }
    checkButton.disabled = true;
    setResult('busy', o.checking);
    let error: ErrorInfo | null = null;
    try {
      const s = await app.settings.get();
      await PROVIDERS.gemini.testConnection({
        apiKey: key,
        model: s.models.gemini,
        timeoutMs: 15_000,
        fetch: nativeFetch,
      });
    } catch (e) {
      error = toErrorInfo(e);
    }
    if (disposed) return;
    checkButton.disabled = false;
    if (!error) {
      // The guide is about Gemini: make it the service, so the key is used straight away.
      await app.keys.set('gemini', key);
      await app.settings.save({ provider: 'gemini' });
      setResult('ok', o.check.ok);
      window.setTimeout(() => !disposed && showStep(3), 900);
      return;
    }
    const outcome = keyCheckOutcome(error.code);
    setResult('error', outcome === 'other' ? errorMessage(error, t) : o.check[outcome]);
  }

  const step2 = h(
    'section',
    { class: 'card step', hidden: true },
    h('h3', { class: 'step-title' }, o.step2Title),
    h('p', { class: 'step-text' }, o.step2Text),
    h(
      'div',
      { class: 'key-field' },
      h('label', { class: 'row-title', for: 'welcome-key' }, o.keyLabel),
      h('span', { class: 'input-group' }, input, toggle),
      h('button', { class: 'btn', onClick: () => void paste() }, o.paste),
      warning,
      fallback,
      result,
    ),
    h(
      'div',
      { class: 'step-actions' },
      h('button', { class: 'btn quiet', onClick: () => showStep(1) }, o.back),
      checkButton,
    ),
  );

  // Step 3: done. Back to the shared video, or try a sample.
  const step3 = h(
    'section',
    { class: 'card step', hidden: true },
    h('div', { class: 'done-mark', 'aria-hidden': 'true' }, '✓'),
    h('h3', { class: 'step-title' }, o.step3Title),
    h('p', { class: 'step-text' }, a.step3Text),
    h(
      'div',
      { class: 'step-actions' },
      h('button', { class: 'btn quiet', onClick: () => app.go('#/') }, a.toHome),
      h(
        'button',
        { class: 'btn primary', onClick: () => app.go(summaryHash(videoId ?? SAMPLE_VIDEO_ID)) },
        videoId ? a.backToVideo : a.tryVideo,
      ),
    ),
  );
  const steps = [step1, step2, step3];

  function showStep(n: number, focus = false) {
    if (disposed) return;
    step = n;
    steps.forEach((s, i) => (s.hidden = i + 1 !== n));
    progressLabel.textContent = o.progress(n, STEPS);
    progressBar.setAttribute('aria-valuenow', String(n));
    bar.style.width = `${(n / STEPS) * 100}%`;
    stepNames.forEach((li, i) => {
      li.classList.toggle('current', i + 1 === n);
      li.classList.toggle('done', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (n === 2 && focus) input.focus();
  }

  const el = h(
    'div',
    { class: 'screen settings welcome' },
    h(
      'section',
      { class: 'hero' },
      h('h2', { class: 'hero-title' }, o.welcome),
      h('p', {}, o.intro),
      language,
    ),
    h(
      'nav',
      { class: 'progress', 'aria-labelledby': 'welcome-progress' },
      progressLabel,
      progressBar,
      h('ol', { class: 'progress-steps' }, ...stepNames),
    ),
    ...steps,
    h('p', { class: 'more-help' }, h('a', { href: `${LANDING_PAGE}#faq` }, o.moreHelp)),
  );

  // Someone opening the guide again sees the key they already have.
  void app.keys.get().then((keys) => {
    if (disposed || input.value) return;
    input.value = keys.gemini;
    updateWarning();
  });
  showStep(1);

  return {
    title: t.settings.setupGuide,
    el,
    // Android back: one step back within the guide, then the screen before it.
    back: () => {
      if (step !== 2) return false;
      showStep(1);
      return true;
    },
    dispose: () => {
      disposed = true;
    },
  };
}
