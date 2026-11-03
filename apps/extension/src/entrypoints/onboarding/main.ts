// Setup guide: three steps from install to a working Gemini key. Step 1 sends the user
// to AI Studio, step 2 tests the pasted key (in the background, like "Test verbinding")
// and only saves it when it works, step 3 switches The Point on and opens a video.
import {
  errorMessage,
  messages,
  UI_LANGUAGE_NAMES,
  UI_LANGUAGES,
  type Messages,
  type UiLang,
} from '@the-point/core/i18n/messages';
import {
  cleanKey,
  keyCheckOutcome,
  LANDING_PAGE,
  looksLikeGeminiKey,
  SAMPLE_VIDEO_ID,
} from '@the-point/core/onboarding';
import type { RuntimeRequest, TestConnectionResult } from '../../messages';
import { getApiKeys, setApiKey } from '../../storage/secrets';
import { getSettings, saveSettings } from '../../storage/settings';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = <T>(msg: RuntimeRequest) => browser.runtime.sendMessage(msg) as Promise<T>;
const STEPS = 3;

let t: Messages = messages('nl');
let step = 1;
/** Last test outcome, kept so a language change can show it again. */
let result: { kind: 'busy' | 'ok' | 'error'; text: () => string } | null = null;

function applyTexts(): void {
  const o = t.onboarding as unknown as Record<string, unknown>;
  document.documentElement.lang = t.locale.split('-')[0]!;
  document.title = t.onboarding.title;
  $('#subtitle').textContent = t.settings.setupGuide;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const [name, index] = el.dataset.i18n!.split('.');
    const value = o[name!];
    el.textContent = String(Array.isArray(value) ? value[Number(index)] : (value ?? name));
  });
  const li = (text: string) => Object.assign(document.createElement('li'), { textContent: text });
  $('#steps1').replaceChildren(...t.onboarding.steps1.map(li));
  $('#reassurance').replaceChildren(...t.onboarding.reassurance.map(li));
  const key = $<HTMLInputElement>('#key');
  $('#toggle-key').textContent = key.type === 'password' ? t.onboarding.show : t.onboarding.hide;
  showResult();
  showStep(step);
}

function showStep(n: number): void {
  step = n;
  document.querySelectorAll<HTMLElement>('.step').forEach((s) => {
    s.hidden = Number(s.dataset.step) !== n;
  });
  $('#progress-label').textContent = t.onboarding.progress(n, STEPS);
  const bar = $('.progress-bar');
  bar.setAttribute('aria-valuenow', String(n));
  bar.querySelector('span')!.style.width = `${(n / STEPS) * 100}%`;
  document.querySelectorAll<HTMLElement>('.progress-steps li').forEach((li) => {
    const own = Number(li.dataset.for);
    li.classList.toggle('current', own === n);
    li.classList.toggle('done', own < n);
    if (own === n) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

function showResult(): void {
  const out = $('#check-result');
  out.className = result ? `check-result ${result.kind}` : 'check-result';
  out.textContent = result?.text() ?? '';
}

/** Gentle hint while typing or after pasting; never blocks saving. */
function updateFormatWarning(): void {
  const key = cleanKey($<HTMLInputElement>('#key').value);
  $('#format-warning').hidden = key === '' || looksLikeGeminiKey(key);
}

async function checkAndSave(): Promise<void> {
  const input = $<HTMLInputElement>('#key');
  const button = $<HTMLButtonElement>('#check-save');
  const key = cleanKey(input.value);
  input.value = key;
  updateFormatWarning();
  if (!key) {
    result = { kind: 'error', text: () => t.onboarding.check.invalid };
    showResult();
    input.focus();
    return;
  }
  button.disabled = true;
  result = { kind: 'busy', text: () => t.onboarding.checking };
  showResult();
  const settings = await getSettings();
  const res = await send<TestConnectionResult>({
    type: 'testConnection',
    provider: 'gemini',
    apiKey: key,
    model: settings.models.gemini,
  }).catch((e: unknown) => ({
    ok: false as const,
    error: { code: 'internal' as const, message: String(e) },
  }));
  button.disabled = false;
  const outcome = keyCheckOutcome(res.ok ? null : res.error.code);
  if (res.ok) {
    // The guide is about Gemini: make it the service, so the key is used straight away.
    await setApiKey('gemini', key);
    await saveSettings({ provider: 'gemini', actief: true });
    $<HTMLInputElement>('#actief').checked = true;
    result = { kind: 'ok', text: () => t.onboarding.check.ok };
    showResult();
    window.setTimeout(() => showStep(3), 900);
    return;
  }
  const error = res.error;
  result = {
    kind: 'error',
    text: () =>
      outcome === 'other' ? errorMessage(error, t) : t.onboarding.check[outcome],
  };
  showResult();
}

async function paste(): Promise<void> {
  const input = $<HTMLInputElement>('#key');
  const fallback = $('#paste-fallback');
  try {
    const text = await navigator.clipboard.readText();
    input.value = cleanKey(text);
    fallback.hidden = true;
    updateFormatWarning();
  } catch {
    // No clipboard access (no permission asked for): let the user paste by hand.
    fallback.hidden = false;
    input.focus();
  }
}

async function init(): Promise<void> {
  const [s, keys] = await Promise.all([getSettings(), getApiKeys()]);
  t = messages(s.interfaceTaal);

  const select = $<HTMLSelectElement>('#interfaceTaal');
  select.replaceChildren(
    ...UI_LANGUAGES.map((code) =>
      Object.assign(document.createElement('option'), {
        value: code,
        textContent: UI_LANGUAGE_NAMES[code],
      }),
    ),
  );
  select.value = s.interfaceTaal;
  select.addEventListener('change', () => {
    t = messages(select.value);
    applyTexts();
    void saveSettings({ interfaceTaal: select.value as UiLang });
  });

  const key = $<HTMLInputElement>('#key');
  key.value = keys.gemini;
  key.addEventListener('input', () => {
    $('#paste-fallback').hidden = true;
    updateFormatWarning();
    if (result?.kind === 'error') {
      result = null;
      showResult();
    }
  });
  key.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void checkAndSave();
  });
  $('#toggle-key').addEventListener('click', () => {
    key.type = key.type === 'password' ? 'text' : 'password';
    $('#toggle-key').textContent = key.type === 'password' ? t.onboarding.show : t.onboarding.hide;
  });
  $('#paste').addEventListener('click', () => void paste());
  $('#check-save').addEventListener('click', () => void checkAndSave());

  // After opening AI Studio the user comes back here to paste: be on step 2 by then.
  $('#get-key').addEventListener('click', () => showStep(2));
  $('#to-step2').addEventListener('click', () => {
    showStep(2);
    key.focus();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-back]').forEach((b) =>
    b.addEventListener('click', () => showStep(Number(b.dataset.back))),
  );

  const actief = $<HTMLInputElement>('#actief');
  actief.checked = s.actief;
  actief.addEventListener('change', () => void saveSettings({ actief: actief.checked }));
  $<HTMLAnchorElement>('#try-video').href = `https://www.youtube.com/watch?v=${SAMPLE_VIDEO_ID}`;
  $<HTMLAnchorElement>('#more-help').href = `${LANDING_PAGE}#faq`;
  $('#open-settings').addEventListener('click', () => void browser.runtime.openOptionsPage());

  updateFormatWarning();
  applyTexts();
}

void init();
