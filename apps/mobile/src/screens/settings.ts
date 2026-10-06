// Settings: AI service, keys and models (with "Test verbinding"), language, the
// video fallback, read aloud and the cache. Every change is saved directly.
import { MODEL_SUGGESTIONS } from '@the-point/core/engine/config';
import { languageName, LANGUAGES } from '@the-point/core/engine/prompt';
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
  const el = h('div', { class: 'screen settings' }, h('p', { class: 'hint' }, 'Laden…'));
  let refreshVoices = () => {};
  void build(app, el).then((r) => (refreshVoices = r));
  return { title: 'Instellingen', el, refresh: () => refreshVoices() };
}

async function build(app: App, el: HTMLElement): Promise<() => void> {
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
      h('option', { value: code, selected: code === s.taal }, languageName(code)),
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
    const groups = groupVoices(app.speaker.voices, s.taal, languageName(s.taal));
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
        : [h('option', { value: '' }, 'Geen stemmen gevonden')]),
    );
  };
  const rateOut = h('output', {}, `${s.spreeksnelheid.toFixed(2)}×`);
  const rate = h('input', {
    type: 'range',
    min: '0.75',
    max: '1.5',
    step: '0.05',
    value: String(s.spreeksnelheid),
    onInput: (e: Event) =>
      (rateOut.textContent = `${Number((e.target as HTMLInputElement).value).toFixed(2)}×`),
    onChange: (e: Event) =>
      void save({ spreeksnelheid: Number((e.target as HTMLInputElement).value) }),
  });
  const testVoice = () =>
    void app.speaker
      .speakText(s.taal === 'nl' ? 'Dit is een test van het voorlezen.' : 'This is a test.', {
        taal: s.taal,
        rate: s.spreeksnelheid,
        voiceUri: s.stemmen[s.taal],
      })
      .catch((e) => app.toast(`Voorlezen mislukt: ${String(e)}`));

  // Cache
  const count = h('span', {}, '…');
  const updateCount = async () => {
    const n = (await app.cache.recent()).length;
    count.textContent = n === 1 ? '1 samenvatting' : `${n} samenvattingen`;
  };
  const clear = async () => {
    if (!window.confirm('Alle opgeslagen samenvattingen wissen?')) return;
    await app.cache.clear();
    await updateCount();
  };

  el.replaceChildren(
    h(
      'section',
      {},
      h('h2', {}, 'AI-dienst'),
      h('div', { class: 'radio-row', role: 'radiogroup', 'aria-label': 'AI-dienst' }, ...radios),
    ),
    ...PROVIDER_IDS.map((p) => sections[p]!),
    h(
      'section',
      {},
      h('h2', {}, 'Samenvatting'),
      h('label', { class: 'field' }, h('span', {}, 'Taal van de samenvatting'), taal),
    ),
    h(
      'section',
      {},
      h('h2', {}, "Video's zonder transcript"),
      h(
        'label',
        { class: 'check' },
        fallback,
        h(
          'span',
          {},
          'Gemini de video zelf laten bekijken',
          h('small', {}, "Trager en duurder. Vereist een Gemini-sleutel; alleen openbare video's."),
        ),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', {}, 'Eerst bevestiging vragen vanaf (minuten)'),
        minutes,
      ),
    ),
    h(
      'section',
      {},
      h('h2', {}, 'Voorlezen'),
      h('label', { class: 'field' }, h('span', {}, 'Stem'), voiceSelect),
      h('label', { class: 'field' }, h('span', {}, 'Snelheid ', rateOut), rate),
      h('div', { class: 'row' }, h('button', { onClick: testVoice }, 'Test stem')),
    ),
    h(
      'section',
      {},
      h('h2', {}, 'Opgeslagen samenvattingen'),
      h('div', { class: 'row' }, count, h('button', { onClick: () => void clear() }, 'Wissen')),
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
  const keyInput = h('input', {
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: info.placeholder,
    value: key,
    'aria-label': `API-sleutel ${info.name}`,
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
        toggle.textContent = show ? 'Verberg' : 'Toon';
      },
    },
    'Toon',
  );

  const listId = `models-${p}`;
  const model = h('input', {
    list: listId,
    spellcheck: 'false',
    value: current().models[p],
    'aria-label': `Model ${info.name}`,
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
      result.textContent = 'Vul eerst een API-sleutel in.';
      return;
    }
    result.className = 'test-result';
    result.textContent = 'Bezig…';
    try {
      await app.keys.set(p, apiKey);
      await PROVIDERS[p].testConnection({
        apiKey,
        model: model.value.trim() || current().models[p],
        timeoutMs: 15_000,
        fetch: nativeFetch,
      });
      result.className = 'test-result ok';
      result.textContent = 'Verbinding werkt';
    } catch (e) {
      result.className = 'test-result bad';
      result.textContent = toErrorInfo(e).message;
    }
  };

  return h(
    'section',
    { 'data-provider': p },
    h('h2', {}, info.name),
    h(
      'label',
      { class: 'field' },
      h('span', {}, 'API-sleutel'),
      h('span', { class: 'key-row' }, keyInput, toggle),
      h(
        'small',
        {},
        'Maak een sleutel aan op ',
        h('a', { href: info.url }, new URL(info.url).hostname),
        '. De sleutel staat versleuteld op dit toestel.',
      ),
    ),
    h(
      'label',
      { class: 'field' },
      h('span', {}, 'Model'),
      model,
      h('datalist', { id: listId }, ...MODEL_SUGGESTIONS[p].map((m) => h('option', { value: m }))),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { onClick: () => void test() }, 'Test verbinding'),
      result,
    ),
  );
}
