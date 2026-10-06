// Settings: AI service, keys and models (with "Test verbinding"), language, the
// video fallback, read aloud and the cache. Every change is saved directly.
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
import type { App, Screen } from '../app';
import { nativeFetch } from '../nativeFetch';

const PROVIDER_IDS: ProviderId[] = ['claude', 'gemini'];
const PROVIDER_INFO: Record<ProviderId, { name: string; placeholder: string; url: string }> = {
  claude: {
    name: 'Claude',
    placeholder: 'sk-ant-…',
    url: 'https://console.anthropic.com/settings/keys',
  },
  gemini: { name: 'Gemini', placeholder: 'AIza…', url: 'https://aistudio.google.com/apikey' },
};

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: number | undefined;
  return (...a) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

export function settingsScreen(app: App): Screen {
  const el = h(
    'div',
    { class: 'screen settings' },
    h('p', { class: 'hint' }, app.t.settings.loading),
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

  // AI service
  const sections: Partial<Record<ProviderId, HTMLElement>> = {};
  const updateSections = () => {
    for (const p of PROVIDER_IDS) {
      const sec = sections[p];
      if (sec) sec.hidden = p !== s.provider && !(p === 'gemini' && s.geminiTerugval);
    }
  };
  const radios = PROVIDER_IDS.map((p) =>
    h(
      'label',
      { class: 'choice' },
      h('input', {
        type: 'radio',
        name: 'provider',
        value: p,
        checked: s.provider === p,
        onChange: async () => {
          await save({ provider: p });
          updateSections();
        },
      }),
      h('span', {}, PROVIDER_INFO[p].name),
    ),
  );

  for (const p of PROVIDER_IDS) sections[p] = providerSection(app, p, keys[p], () => s, save);

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

  // Video fallback
  const fallback = h('input', {
    type: 'checkbox',
    checked: s.geminiTerugval,
    onChange: async (e: Event) => {
      await save({ geminiTerugval: (e.target as HTMLInputElement).checked });
      updateSections();
    },
  });
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
  const count = h('span', {}, '…');
  const updateCount = async () => {
    const n = (await app.cache.recent()).length;
    count.textContent = T.summaryCount(n);
  };
  const clear = async () => {
    if (!window.confirm(T.confirmClear)) return;
    await app.cache.clear();
    await updateCount();
  };

  el.replaceChildren(
    h(
      'section',
      {},
      h('h2', {}, T.languageHeading),
      h('label', { class: 'field' }, h('span', {}, T.interfaceLanguage), interfaceTaal),
      h('label', { class: 'field' }, h('span', {}, T.summaryLanguage), taal),
    ),
    h(
      'section',
      {},
      h('h2', {}, T.aiService),
      h('div', { class: 'radio-row', role: 'radiogroup', 'aria-label': T.aiService }, ...radios),
    ),
    ...PROVIDER_IDS.map((p) => sections[p]!),
    h(
      'section',
      {},
      h('h2', {}, T.noTranscriptHeading),
      h(
        'label',
        { class: 'check' },
        fallback,
        h('span', {}, T.fallbackShort, h('small', {}, T.fallbackHintShort)),
      ),
      h('label', { class: 'field' }, h('span', {}, T.confirmFromMinutes), minutes),
    ),
    h(
      'section',
      {},
      h('h2', {}, T.readAloudHeading),
      h('label', { class: 'field' }, h('span', {}, T.voice), voiceSelect),
      h('label', { class: 'field' }, h('span', {}, `${T.speed} `, rateOut), rate),
      h('div', { class: 'row' }, h('button', { onClick: testVoice }, T.testVoice)),
    ),
    h(
      'section',
      {},
      h('h2', {}, T.savedSummaries),
      h('div', { class: 'row' }, count, h('button', { onClick: () => void clear() }, T.clear)),
    ),
  );
  updateSections();
  fillVoices();
  void updateCount();
  return fillVoices;
}

function providerSection(
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
      class: 'ghost',
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
    'section',
    { 'data-provider': p },
    h('h2', {}, info.name),
    h(
      'label',
      { class: 'field' },
      h('span', {}, T.apiKey),
      h('span', { class: 'key-row' }, keyInput, toggle),
      h(
        'small',
        {},
        T.keyHintDevice[0],
        h('a', { href: info.url }, new URL(info.url).hostname),
        T.keyHintDevice[1],
      ),
    ),
    h(
      'label',
      { class: 'field' },
      h('span', {}, T.model),
      model,
      h('datalist', { id: listId }, ...MODEL_SUGGESTIONS[p].map((m) => h('option', { value: m }))),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { onClick: () => void test() }, T.testConnection),
      result,
    ),
  );
}
