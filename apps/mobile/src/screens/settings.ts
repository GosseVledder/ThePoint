// Settings: AI service, keys and models (with "Test verbinding"), language, read aloud,
// the video fallback and the cache. Every change is saved directly. Same design as the
// extension's options page: grouped cards with switches and stacked fields.
import { MODEL_SUGGESTIONS } from '@the-point/core/engine/config';
import { LANGUAGES } from '@the-point/core/engine/prompt';
import {
  errorMessage,
  messages,
  UI_LANGUAGE_NAMES,
  UI_LANGUAGES,
  type UiLang,
} from '@the-point/core/i18n/messages';
import { PROVIDERS } from '@the-point/core/engine/summarize';
import type { ProviderId } from '@the-point/core/engine/types';
import { toErrorInfo } from '@the-point/core/job';
import { h } from '@the-point/core/ui/render';
import { groupVoices, voiceLabel } from '@the-point/core/ui/speechText';
import type { Settings } from '@the-point/core/settings';
import type { ReleaseAsset } from '@the-point/core/update';
import type { App, Screen } from '../app';
import { checkAppUpdate, downloadAndInstall, installedVersion, UpdateError } from '../appUpdate';
import { nativeFetch } from '../nativeFetch';

const PROVIDER_IDS: ProviderId[] = ['claude', 'gemini'];
const PROVIDER_INFO: Record<
  ProviderId,
  { name: string; vendor: string; placeholder: string; url: string }
> = {
  claude: {
    name: 'Claude',
    vendor: 'Anthropic',
    placeholder: 'sk-ant-…',
    url: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    name: 'Gemini',
    vendor: 'Google',
    placeholder: 'AIza…',
    url: 'https://aistudio.google.com/apikey',
  },
};

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: number | undefined;
  return (...a) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

/** A titled group with one card. */
const group = (title: string, ...children: (Node | null)[]) =>
  h('section', { class: 'group' }, h('h2', {}, title), h('div', { class: 'card' }, ...children));

/** Label above a full-width control, optional hint below. */
const field = (title: Node | string, control: Node, hint?: Node | string | null) =>
  h(
    'label',
    { class: 'field' },
    h('span', { class: 'row-title' }, title),
    control,
    hint ? h('span', { class: 'row-hint' }, hint) : null,
  );

/** A whole-row switch: text on the left, the switch on the right. */
const switchRow = (title: string, hint: string, input: HTMLInputElement) =>
  h(
    'label',
    { class: 'row' },
    h(
      'span',
      { class: 'row-text' },
      h('span', { class: 'row-title' }, title),
      h('span', { class: 'row-hint' }, hint),
    ),
    input,
  );

export function settingsScreen(app: App): Screen {
  const el = h(
    'div',
    { class: 'screen settings' },
    h('p', { class: 'hint loading' }, app.t.settings.loading),
  );
  let refreshVoices = () => {};
  void build(app, el).then((r) => (refreshVoices = r));
  return { title: app.t.settings.title, el, refresh: () => refreshVoices() };
}

async function build(app: App, el: HTMLElement): Promise<() => void> {
  const t = app.t;
  const T = t.settings;
  let s: Settings = await app.settings.get();
  const keys = await app.keys.get();
  const save = async (patch: Partial<Settings>) => {
    s = await app.settings.save(patch);
  };

  // AI service: the chosen provider's key block; Gemini also while the fallback is on.
  const blocks = Object.fromEntries(
    PROVIDER_IDS.map((p) => [p, providerBlock(app, p, keys[p], () => s, save)]),
  ) as Record<ProviderId, HTMLElement>;
  const aiCard = h('div', { class: 'card' });
  const updateBlocks = () => {
    let shown = 0;
    for (const p of PROVIDER_IDS) {
      blocks[p].hidden = p !== s.provider && !(p === 'gemini' && s.geminiTerugval);
      if (!blocks[p].hidden) shown++;
    }
    aiCard.classList.toggle('both', shown > 1);
  };
  const segments = PROVIDER_IDS.map((p) =>
    h(
      'label',
      { class: 'segment' },
      h('input', {
        type: 'radio',
        name: 'provider',
        value: p,
        checked: s.provider === p,
        onChange: async () => {
          await save({ provider: p });
          updateBlocks();
        },
      }),
      h('span', {}, h('b', {}, PROVIDER_INFO[p].name), h('small', {}, PROVIDER_INFO[p].vendor)),
    ),
  );
  aiCard.append(
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': T.aiService }, ...segments),
    h('p', { class: 'card-intro' }, T.providerHint),
    ...PROVIDER_IDS.map((p) => blocks[p]),
  );

  // Interface language (each in its own name); changing it rebuilds the screen.
  const interfaceTaal = h(
    'select',
    {
      onChange: async (e: Event) => {
        const lang = (e.target as HTMLSelectElement).value as UiLang;
        await save({ interfaceTaal: lang });
        app.setLanguage(lang);
      },
    },
    ...UI_LANGUAGES.map((code) =>
      h('option', { value: code, selected: code === s.interfaceTaal }, UI_LANGUAGE_NAMES[code]),
    ),
  );

  // Summary language
  const taal = h(
    'select',
    {
      onChange: async (e: Event) => {
        await save({ taal: (e.target as HTMLSelectElement).value });
        fillVoices();
      },
    },
    ...Object.keys(LANGUAGES).map((code) =>
      h('option', { value: code, selected: code === s.taal }, t.languageNames[code] ?? code),
    ),
  );

  // Video fallback; the confirmation only applies to it.
  const minutes = h('input', {
    type: 'number',
    min: '1',
    max: '600',
    step: '1',
    value: String(s.bevestigVanafMinuten),
    inputmode: 'numeric',
    onChange: async (e: Event) => {
      const input = e.target as HTMLInputElement;
      await save({ bevestigVanafMinuten: Number(input.value) });
      input.value = String(s.bevestigVanafMinuten);
    },
  });
  const minutesField = field(
    T.confirmLonger,
    h('span', { class: 'unit-row' }, minutes, h('span', { class: 'unit' }, T.minutes)),
  );
  const updateMinutes = () => {
    minutes.disabled = !s.geminiTerugval;
    minutesField.classList.toggle('dim', !s.geminiTerugval);
  };
  const fallback = h('input', {
    type: 'checkbox',
    class: 'switch',
    role: 'switch',
    checked: s.geminiTerugval,
    onChange: async (e: Event) => {
      await save({ geminiTerugval: (e.target as HTMLInputElement).checked });
      updateBlocks();
      updateMinutes();
    },
  });

  // Read aloud
  const voiceSelect = h('select', {
    onChange: async (e: Event) => {
      await save({ stemmen: { ...s.stemmen, [s.taal]: (e.target as HTMLSelectElement).value } });
    },
  });
  const fillVoices = () => {
    const chosen = app.speaker.voiceFor(s.taal, s.stemmen[s.taal]);
    const naam = t.languageNames[s.taal] ?? s.taal;
    const groups = groupVoices(app.speaker.voices, s.taal, naam, t.view.otherLanguages);
    voiceSelect.replaceChildren(
      ...(groups.length
        ? groups.map((g) =>
            h(
              'optgroup',
              { label: g.label },
              ...g.voices.map((v) =>
                h('option', { value: v.voiceURI, selected: v === chosen }, voiceLabel(v)),
              ),
            ),
          )
        : [h('option', { value: '' }, T.noVoicesFound)]),
    );
  };
  const speed = (v: number) => `${v.toLocaleString(t.locale, { minimumFractionDigits: 2 })}×`;
  const rateOut = h('output', {}, speed(s.spreeksnelheid));
  const rate = h('input', {
    type: 'range',
    min: '0.75',
    max: '1.5',
    step: '0.05',
    value: String(s.spreeksnelheid),
    onInput: (e: Event) =>
      (rateOut.textContent = speed(Number((e.target as HTMLInputElement).value))),
    onChange: (e: Event) =>
      void save({ spreeksnelheid: Number((e.target as HTMLInputElement).value) }),
  });
  const testVoice = () =>
    void app.speaker
      .speakText(messages(s.taal).speech.sample, {
        taal: s.taal,
        rate: s.spreeksnelheid,
        voiceUri: s.stemmen[s.taal],
      })
      .catch((e) => app.toast(T.speechFailed(String(e))));

  // Cache
  const count = h('span', { class: 'row-hint' }, '…');
  const updateCount = async () => {
    const n = (await app.cache.recent()).length;
    count.textContent = T.summaryCount(n);
  };
  const clear = async () => {
    if (!window.confirm(T.confirmClear)) return;
    await app.cache.clear();
    await updateCount();
  };

  const version = installedVersion();
  const versionText = h('span', {});
  el.replaceChildren(
    h('section', { class: 'group' }, h('h2', {}, T.aiService), aiCard),
    group(
      T.languageHeading,
      field(T.interfaceLanguage, interfaceTaal),
      field(T.summaryLanguage, taal),
    ),
    group(
      T.readAloudHeading,
      field(T.voice, voiceSelect),
      field(h('span', { class: 'title-value' }, h('span', {}, T.speed), rateOut), rate),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', onClick: testVoice }, T.testVoice),
      ),
    ),
    group(
      T.noTranscriptHeading,
      switchRow(T.fallbackShort, T.fallbackHintShort, fallback),
      minutesField,
    ),
    group(
      T.savedSummaries,
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, T.cacheHeading), count),
        h('button', { class: 'btn danger', onClick: () => void clear() }, T.clear),
      ),
    ),
    updateGroup(app, version),
    h('footer', { class: 'foot' }, versionText, h('span', {}, T.autoSaved)),
  );
  updateBlocks();
  updateMinutes();
  void updateCount();
  fillVoices();
  void version.then((v) => v && (versionText.textContent = `The Point ${v}`));
  return fillVoices;
}

/**
 * Updates: compare with the latest GitHub release; a newer APK is downloaded, checked
 * (SHA-256) and handed to the Android installer, which asks the user to confirm.
 */
function updateGroup(app: App, version: Promise<string | null>): HTMLElement {
  const U = app.t.update;
  const title = h('span', { class: 'row-title' }, U.installed('…'));
  const status = h('span', { class: 'row-hint update-status', 'aria-live': 'polite' });
  const panel = h('div', { class: 'update-panel', hidden: true });
  let current: string | null = null;
  const setStatus = (text: string, state: string) => {
    status.textContent = text;
    status.dataset.state = state;
  };

  const showAvailable = (asset: ReleaseAsset, page: string) => {
    const progress = h('span', { class: 'row-hint', 'aria-live': 'polite' });
    const install: HTMLButtonElement = h(
      'button',
      {
        class: 'btn primary',
        onClick: async () => {
          install.disabled = true;
          progress.className = 'row-hint';
          progress.textContent = U.downloading;
          try {
            await downloadAndInstall(
              asset,
              (p) => (progress.textContent = `${U.downloading} ${p}%`),
            );
            progress.textContent = U.opening;
          } catch (e) {
            progress.className = 'row-hint bad';
            progress.textContent =
              e instanceof UpdateError && e.code === 'checksum'
                ? U.checksumFailed
                : U.downloadFailed(e instanceof Error ? e.message : String(e));
          }
          install.disabled = false;
        },
      },
      U.downloadInstall,
    );
    panel.replaceChildren(
      h(
        'p',
        { class: 'update-head' },
        h('b', {}, U.available(asset.version)),
        h('a', { href: page }, U.whatsNew),
      ),
      install,
      progress,
      h('span', { class: 'row-hint' }, U.installHint),
    );
    panel.hidden = false;
  };

  const check: HTMLButtonElement = h(
    'button',
    {
      class: 'btn',
      disabled: true,
      onClick: async () => {
        if (!current) return;
        check.disabled = true;
        panel.hidden = true;
        setStatus(U.checking, 'checking');
        try {
          const r = await checkAppUpdate(current);
          if (r.status === 'available') {
            setStatus('', 'available');
            showAvailable(r.asset, r.page);
          } else setStatus(r.status === 'current' ? U.upToDate : U.none, r.status);
        } catch (e) {
          setStatus(U.failed(e instanceof Error ? e.message : String(e)), 'error');
        }
        check.disabled = false;
      },
    },
    U.check,
  );
  void version.then((v) => {
    current = v;
    title.textContent = U.installed(v ?? '–');
    check.disabled = !v;
  });

  return group(
    U.heading,
    h('div', { class: 'field' }, title, status),
    h('div', { class: 'actions' }, check),
    panel,
  );
}

function providerBlock(
  app: App,
  p: ProviderId,
  key: string,
  current: () => Settings,
  save: (patch: Partial<Settings>) => Promise<void>,
): HTMLElement {
  const info = PROVIDER_INFO[p];
  const T = app.t.settings;
  const keyInput = h('input', {
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: info.placeholder,
    value: key,
    'aria-label': T.apiKeyOf(info.name),
  });
  keyInput.addEventListener(
    'input',
    debounce(() => void app.keys.set(p, keyInput.value), 400),
  );
  const toggle: HTMLButtonElement = h(
    'button',
    {
      type: 'button',
      onClick: () => {
        const show = keyInput.type === 'password';
        keyInput.type = show ? 'text' : 'password';
        toggle.textContent = show ? T.hide : T.show;
      },
    },
    T.show,
  );

  const listId = `models-${p}`;
  const model = h('input', {
    list: listId,
    spellcheck: 'false',
    value: current().models[p],
    'aria-label': T.modelOf(info.name),
  });
  model.addEventListener(
    'input',
    debounce(() => {
      const m = model.value.trim();
      if (m) void save({ models: { ...current().models, [p]: m } });
    }, 400),
  );
  model.addEventListener('blur', () => {
    if (!model.value.trim()) model.value = current().models[p];
  });

  const result = h('span', { class: 'test-result', 'aria-live': 'polite' });
  const test = async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      result.className = 'test-result bad';
      result.textContent = T.fillKeyFirst;
      return;
    }
    result.className = 'test-result';
    result.textContent = T.busy;
    try {
      await app.keys.set(p, apiKey);
      await PROVIDERS[p].testConnection({
        apiKey,
        model: model.value.trim() || current().models[p],
        timeoutMs: 15_000,
        fetch: nativeFetch,
      });
      result.className = 'test-result ok';
      result.textContent = T.testOkShort;
    } catch (e) {
      result.className = 'test-result bad';
      result.textContent = errorMessage(toErrorInfo(e), app.t);
    }
  };

  return h(
    'div',
    { class: 'provider', 'data-provider': p },
    h(
      'div',
      { class: 'provider-head' },
      h('h3', {}, info.name),
      p === 'gemini' ? h('span', { class: 'tag' }, T.alsoForFallback) : null,
    ),
    field(
      T.apiKey,
      h('span', { class: 'input-group' }, keyInput, toggle),
      h(
        'span',
        {},
        T.keyHintDevice[0],
        h('a', { href: info.url }, new URL(info.url).hostname),
        T.keyHintDevice[1],
      ),
    ),
    field(T.model, model),
    h('datalist', { id: listId }, ...MODEL_SUGGESTIONS[p].map((m) => h('option', { value: m }))),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn', onClick: () => void test() }, T.testConnection),
      result,
    ),
  );
}
