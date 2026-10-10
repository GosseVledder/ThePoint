import { MODEL_SUGGESTIONS } from '@the-point/core/engine/config';
import { LANGUAGES } from '@the-point/core/engine/prompt';
import type { ProviderId } from '@the-point/core/engine/types';
import {
  errorMessage,
  messages,
  UI_LANGUAGE_NAMES,
  UI_LANGUAGES,
  type Messages,
  type UiLang,
} from '@the-point/core/i18n/messages';
import {
  REOPEN_OPTIONS_KEY,
  type RuntimeRequest,
  type TestConnectionResult,
  type UpdateCheckResult,
} from '../../messages';
import type { DebugEntry } from '../../storage/debuglog';
import { getApiKeys, setApiKey } from '../../storage/secrets';
import { getSettings, saveSettings, type Settings } from '../../storage/settings';
import { speaker } from '../../ui/speech';
import { groupVoices, pickVoice, voiceLabel } from '@the-point/core/ui/speechText';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = <T>(msg: RuntimeRequest) => browser.runtime.sendMessage(msg) as Promise<T>;
const PROVIDERS: ProviderId[] = ['claude', 'gemini'];

/** Interface texts; replaced when the interface language changes. */
let t: Messages = messages('nl');
/** Parts of the page that show computed texts and must follow a language change. */
const onLanguage: (() => void)[] = [];

/**
 * Fill every [data-i18n] element. Keys come from `settings` unless prefixed with another
 * section ("update:check"); "keyHintBrowser.0" picks an element of an array.
 */
function applyTexts(): void {
  const lookup = (key: string): string => {
    const [path, index] = key.split('.');
    const [section, name] = path!.includes(':') ? path!.split(':') : ['settings', path];
    const value = (t as unknown as Record<string, Record<string, unknown>>)[section!]?.[name!];
    return String(Array.isArray(value) ? value[Number(index)] : (value ?? key));
  };
  document.documentElement.lang = t.locale.split('-')[0]!;
  document.title = t.extension.actionTitle;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = lookup(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', lookup(el.dataset.i18nAria!));
  });
  onLanguage.forEach((fn) => fn());
}

let savedTimer: number | undefined;
function flashSaved(): void {
  const el = $('#saved');
  el.textContent = t.settings.saved;
  el.classList.add('show');
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => el.classList.remove('show'), 1500);
}

async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  flashSaved();
}

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let timer: number | undefined;
  return (...a) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...a), ms);
  };
}

const option = (value: string, text: string) =>
  Object.assign(document.createElement('option'), { value, textContent: text });

async function init(): Promise<void> {
  const [s, keys] = await Promise.all([getSettings(), getApiKeys()]);
  t = messages(s.interfaceTaal);
  $('#version').textContent = `The Point ${browser.runtime.getManifest().version}`;

  // Languages: the interface language in its own name, summary languages in the
  // interface language.
  const ui = $<HTMLSelectElement>('#interfaceTaal');
  ui.replaceChildren(...UI_LANGUAGES.map((code) => option(code, UI_LANGUAGE_NAMES[code])));
  ui.value = s.interfaceTaal;
  ui.addEventListener('change', async () => {
    t = messages(ui.value);
    applyTexts();
    await save({ interfaceTaal: ui.value as UiLang });
  });
  const taal = $<HTMLSelectElement>('#taal');
  const fillLanguages = () => {
    const current = taal.value || s.taal;
    taal.replaceChildren(
      ...Object.keys(LANGUAGES).map((code) => option(code, t.languageNames[code] ?? code)),
    );
    taal.value = current;
  };
  onLanguage.push(fillLanguages);
  taal.addEventListener('change', () => void save({ taal: taal.value }));

  // Provider
  document.querySelectorAll<HTMLInputElement>('input[name="provider"]').forEach((r) => {
    r.checked = r.value === s.provider;
    r.addEventListener('change', () => {
      void save({ provider: r.value as ProviderId });
      updateProviderSections();
    });
  });

  // Keys and models
  for (const p of PROVIDERS) {
    const key = $<HTMLInputElement>(`#key-${p}`);
    const model = $<HTMLInputElement>(`#model-${p}`);
    const list = $(`#models-${p}`);
    key.value = keys[p];
    model.value = s.models[p];
    list.replaceChildren(
      ...MODEL_SUGGESTIONS[p].map((m) =>
        Object.assign(document.createElement('option'), { value: m }),
      ),
    );
    const saveKey = debounce(async () => {
      await setApiKey(p, key.value);
      flashSaved();
    }, 400);
    const saveModel = debounce(async () => {
      if (!model.value.trim()) return;
      const cur = await getSettings();
      await save({ models: { ...cur.models, [p]: model.value.trim() } });
    }, 400);
    key.addEventListener('input', saveKey);
    model.addEventListener('input', saveModel);
    model.addEventListener('blur', async () => {
      if (!model.value.trim()) model.value = (await getSettings()).models[p];
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => {
    const input = $<HTMLInputElement>(`#${b.dataset.toggle}`);
    const label = () => (b.textContent = input.type === 'password' ? t.settings.show : t.settings.hide);
    onLanguage.push(label);
    b.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      label();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => {
    b.addEventListener('click', async () => {
      const p = b.dataset.test as ProviderId;
      const out = $(`#test-${p}`);
      b.disabled = true;
      out.className = 'test-result';
      out.textContent = t.settings.busy;
      const res = await send<TestConnectionResult>({
        type: 'testConnection',
        provider: p,
        apiKey: $<HTMLInputElement>(`#key-${p}`).value,
        model: $<HTMLInputElement>(`#model-${p}`).value.trim(),
      }).catch((e: unknown) => ({
        ok: false as const,
        error: { code: 'internal' as const, message: String(e) },
      }));
      b.disabled = false;
      if (res.ok) {
        out.className = 'test-result ok';
        out.textContent = t.settings.testOk;
      } else {
        out.className = 'test-result error';
        out.textContent = `✗ ${errorMessage(res.error, t)}`;
        out.title = ('details' in res.error ? res.error.details : '') ?? '';
      }
    });
  });

  // Summary options
  for (const id of [
    'automatisch',
    'autoplayPauzeren',
    'markeringen',
    'geminiTerugval',
    'debugLog',
  ] as const) {
    const box = $<HTMLInputElement>(`#${id}`);
    box.checked = s[id];
    box.addEventListener('change', () => void save({ [id]: box.checked }));
  }
  $('#geminiTerugval').addEventListener('change', updateProviderSections);
  updateProviderSections();

  const minutes = $<HTMLInputElement>('#bevestigVanafMinuten');
  minutes.value = String(s.bevestigVanafMinuten);
  minutes.addEventListener(
    'input',
    debounce(() => {
      const n = Math.round(Number(minutes.value));
      if (Number.isFinite(n) && n >= 1 && n <= 600) void save({ bevestigVanafMinuten: n });
    }, 400),
  );
  // The confirmation only applies to the video fallback.
  const fallback = $<HTMLInputElement>('#geminiTerugval');
  const updateConfirmRow = () => {
    $('#confirm-row').classList.toggle('dim', !fallback.checked);
    minutes.disabled = !fallback.checked;
  };
  fallback.addEventListener('change', updateConfirmRow);
  updateConfirmRow();

  // Cache
  let aantal: number | null = null;
  const showCount = () => {
    if (aantal !== null) $('#cache-count').textContent = t.settings.cacheCount(aantal);
  };
  const refreshCount = async () => {
    aantal = (await send<{ aantal: number }>({ type: 'cacheStats' })).aantal;
    showCount();
  };
  onLanguage.push(showCount);
  void refreshCount();
  $('#clear-cache').addEventListener('click', async () => {
    if (!confirm(t.settings.confirmClear)) return;
    await send({ type: 'clearCache' });
    await refreshCount();
  });

  // Debug log
  let logShown = false;
  const showLog = async () => {
    const log = $('#log');
    const entries = await send<DebugEntry[]>({ type: 'getDebugLog' });
    log.hidden = false;
    logShown = true;
    if (entries.length === 0) {
      log.textContent = t.settings.logEmpty;
      return;
    }
    const table = document.createElement('table');
    table
      .createTHead()
      .insertRow()
      .append(
        ...t.settings.logHead.map((h) =>
          Object.assign(document.createElement('th'), { textContent: h }),
        ),
      );
    const body = table.createTBody();
    for (const e of entries.slice().reverse()) {
      const row = body.insertRow();
      const cells = [
        new Date(e.tijd).toLocaleString(t.locale),
        e.videoId,
        e.stap,
        e.provider,
        e.model,
        e.invoerTekens.toLocaleString(t.locale),
        `${(e.duurMs / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 })} s`,
        e.usage ? `${e.usage.inputTokens ?? '–'} / ${e.usage.outputTokens ?? '–'}` : '–',
        e.fout ?? '',
      ];
      cells.forEach((c, i) => {
        const td = row.insertCell();
        td.textContent = c;
        if (i === cells.length - 1 && c) td.className = 'err';
      });
    }
    log.replaceChildren(table);
  };
  onLanguage.push(() => logShown && void showLog());
  $('#show-log').addEventListener('click', () => void showLog());
  $('#clear-log').addEventListener('click', async () => {
    await send({ type: 'clearDebugLog' });
    $('#log').hidden = true;
    logShown = false;
  });

  initUpdate();

  // Read aloud
  await initSpeech(s);
  applyTexts();
}

/**
 * Updates: compare with the latest GitHub release (in the background). An unpacked
 * extension cannot replace its own files, so a newer version is three steps: download
 * the zip, extract it over the folder, reload (which reopens this page).
 */
function initUpdate(): void {
  const version = browser.runtime.getManifest().version;
  const button = $<HTMLButtonElement>('#check-update');
  const status = $('#update-status');
  const panel = $('#update-panel');
  let state: UpdateCheckResult | 'checking' | null = null;

  const show = () => {
    $('#installed-version').textContent = t.update.installed(version);
    panel.hidden = true;
    status.dataset.state = state === null ? '' : state === 'checking' ? 'checking' : state.ok ? state.check.status : 'error';
    if (state === null) status.textContent = '';
    else if (state === 'checking') status.textContent = t.update.checking;
    else if (!state.ok) status.textContent = t.update.failed(state.error);
    else if (state.check.status === 'none') status.textContent = t.update.none;
    else if (state.check.status === 'current') status.textContent = t.update.upToDate;
    else {
      const { asset, page } = state.check;
      status.textContent = '';
      panel.hidden = false;
      $('#update-available').textContent = t.update.available(asset.version);
      $<HTMLAnchorElement>('#update-notes').href = page;
      const download = $<HTMLAnchorElement>('#update-download');
      download.href = asset.url;
      download.textContent = t.update.download(asset.version);
    }
  };
  onLanguage.push(show);

  button.addEventListener('click', async () => {
    button.disabled = true;
    state = 'checking';
    show();
    state = await send<UpdateCheckResult>({ type: 'checkUpdate' }).catch((e: unknown) => ({
      ok: false as const,
      error: String(e),
    }));
    button.disabled = false;
    show();
  });

  $('#update-reload').addEventListener('click', async () => {
    await browser.storage.local.set({ [REOPEN_OPTIONS_KEY]: true });
    browser.runtime.reload();
  });
}

async function initSpeech(initial: Settings): Promise<void> {
  const select = $<HTMLSelectElement>('#stem');
  const hint = $('#stem-hint');
  const rate = $<HTMLInputElement>('#spreeksnelheid');
  const rateOut = $<HTMLOutputElement>('#spreeksnelheid-waarde');
  const test = $<HTMLButtonElement>('#test-stem');
  const showRate = () =>
    (rateOut.textContent = `${Number(rate.value).toLocaleString(t.locale, { minimumFractionDigits: 2 })}×`);
  rate.value = String(initial.spreeksnelheid);
  onLanguage.push(showRate);

  if (!speaker.available) {
    select.disabled = true;
    test.disabled = true;
    onLanguage.push(() => (hint.textContent = t.view.ttsUnsupported));
    return;
  }
  const voices = await speaker.voices();

  let current = initial;
  const fill = () => {
    const s = current;
    const chosen = pickVoice(voices, s.stemmen[s.taal], s.taal);
    const naam = t.languageNames[s.taal] ?? s.taal;
    const groups = groupVoices(voices, s.taal, naam, t.view.otherLanguages);
    select.replaceChildren(
      ...groups.map((g) => {
        const og = document.createElement('optgroup');
        og.label = g.label;
        og.append(
          ...g.voices.map((v) =>
            Object.assign(document.createElement('option'), {
              value: v.voiceURI,
              textContent: voiceLabel(v),
              selected: v.voiceURI === chosen?.voiceURI,
            }),
          ),
        );
        return og;
      }),
    );
    const mine = groups.find((g) => g.label === naam)?.voices.length ?? 0;
    hint.textContent =
      voices.length === 0
        ? t.settings.noVoicesBrowser
        : mine === 0
          ? t.settings.noVoiceFor(naam)
          : t.settings.voicesFor(mine, naam);
  };
  onLanguage.push(fill);
  // The summary language decides which voice is shown as chosen.
  $<HTMLSelectElement>('#taal').addEventListener('change', async () => {
    current = await getSettings();
    fill();
  });

  select.addEventListener('change', async () => {
    const cur = await getSettings();
    await save({ stemmen: { ...cur.stemmen, [cur.taal]: select.value } });
    current = await getSettings();
  });
  rate.addEventListener('input', showRate);
  rate.addEventListener(
    'change',
    () => void save({ spreeksnelheid: Math.round(Number(rate.value) * 100) / 100 }),
  );

  let testing = false;
  test.addEventListener('click', async () => {
    if (testing) {
      speaker.stop();
      return;
    }
    const cur = await getSettings();
    const voice = voices.find((v) => v.voiceURI === select.value) ?? null;
    const lang = voice?.lang.split('-')[0] ?? cur.taal;
    testing = true;
    test.textContent = t.settings.stop;
    speaker.play([{ id: 'kritiek', text: messages(lang).speech.sample }], {
      voice,
      lang: cur.taal,
      rate: Number(rate.value),
      onItem: () => undefined,
      onEnd: () => {
        testing = false;
        test.textContent = t.settings.testVoice;
      },
    });
  });
}

/**
 * Show only the selected provider's key block. Gemini stays visible next to Claude while
 * the no-transcript fallback is on, because that fallback needs a Gemini key; with two
 * blocks each gets a heading.
 */
function updateProviderSections(): void {
  const p = document.querySelector<HTMLInputElement>('input[name="provider"]:checked')?.value;
  const fallback = $<HTMLInputElement>('#geminiTerugval').checked;
  let shown = 0;
  document.querySelectorAll<HTMLElement>('[data-provider]').forEach((block) => {
    const own = block.dataset.provider;
    block.hidden = own !== p && !(own === 'gemini' && fallback);
    if (!block.hidden) shown++;
  });
  $('#ai-card').classList.toggle('both', shown > 1);
}

void init();
