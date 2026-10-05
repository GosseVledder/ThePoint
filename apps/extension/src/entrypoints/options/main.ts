import { MODEL_SUGGESTIONS } from '@yt-ai/core/engine/config';
import { languageName, LANGUAGES } from '@yt-ai/core/engine/prompt';
import type { ProviderId } from '@yt-ai/core/engine/types';
import type { RuntimeRequest, TestConnectionResult } from '../../messages';
import type { DebugEntry } from '../../storage/debuglog';
import { getApiKeys, setApiKey } from '../../storage/secrets';
import { getSettings, saveSettings, type Settings } from '../../storage/settings';
import { speaker } from '../../ui/speech';
import { groupVoices, pickVoice, voiceLabel } from '@yt-ai/core/ui/speechText';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = <T>(msg: RuntimeRequest) => browser.runtime.sendMessage(msg) as Promise<T>;
const PROVIDERS: ProviderId[] = ['claude', 'gemini'];

let savedTimer: number | undefined;
function flashSaved(): void {
  const el = $('#saved');
  el.textContent = 'Opgeslagen';
  el.style.opacity = '1';
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => (el.style.opacity = '0'), 1500);
}

async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  flashSaved();
}

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: number | undefined;
  return (...a) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

async function init(): Promise<void> {
  const [s, keys] = await Promise.all([getSettings(), getApiKeys()]);

  // Provider
  document.querySelectorAll<HTMLInputElement>('input[name="provider"]').forEach((r) => {
    r.checked = r.value === s.provider;
    r.addEventListener('change', () => {
      void save({ provider: r.value as ProviderId });
      markActive(r.value as ProviderId);
    });
  });
  markActive(s.provider);

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
    b.addEventListener('click', () => {
      const input = $<HTMLInputElement>(`#${b.dataset.toggle}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Verberg' : 'Toon';
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => {
    b.addEventListener('click', async () => {
      const p = b.dataset.test as ProviderId;
      const out = $(`#test-${p}`);
      b.disabled = true;
      out.className = 'test-result';
      out.textContent = 'Bezig…';
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
        out.textContent = '✓ Verbinding werkt en het model bestaat.';
      } else {
        out.className = 'test-result error';
        out.textContent = `✗ ${res.error.message}`;
        out.title = ('details' in res.error ? res.error.details : '') ?? '';
      }
    });
  });

  // Summary options
  const taal = $<HTMLSelectElement>('#taal');
  taal.replaceChildren(
    ...Object.entries(LANGUAGES).map(([code, name]) =>
      Object.assign(document.createElement('option'), { value: code, textContent: name }),
    ),
  );
  taal.value = s.taal;
  taal.addEventListener('change', () => void save({ taal: taal.value }));

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

  const minutes = $<HTMLInputElement>('#bevestigVanafMinuten');
  minutes.value = String(s.bevestigVanafMinuten);
  minutes.addEventListener(
    'input',
    debounce(() => {
      const n = Math.round(Number(minutes.value));
      if (Number.isFinite(n) && n >= 1 && n <= 600) void save({ bevestigVanafMinuten: n });
    }, 400),
  );

  // Read aloud
  await initSpeech(s);

  // Cache
  const refreshCount = async () => {
    const { aantal } = await send<{ aantal: number }>({ type: 'cacheStats' });
    $('#cache-count').textContent =
      aantal === 1 ? '1 samenvatting opgeslagen' : `${aantal} samenvattingen opgeslagen`;
  };
  void refreshCount();
  $('#clear-cache').addEventListener('click', async () => {
    if (!confirm('Alle opgeslagen samenvattingen wissen?')) return;
    await send({ type: 'clearCache' });
    await refreshCount();
  });

  // Debug log
  $('#show-log').addEventListener('click', async () => {
    const log = $('#log');
    const entries = await send<DebugEntry[]>({ type: 'getDebugLog' });
    log.hidden = false;
    if (entries.length === 0) {
      log.textContent = 'Nog geen aanroepen gelogd.';
      return;
    }
    const table = document.createElement('table');
    const head = [
      'Tijd',
      'Video',
      'Stap',
      'Provider',
      'Model',
      'Invoer (tekens)',
      'Duur',
      'Tokens in/uit',
      'Fout',
    ];
    table
      .createTHead()
      .insertRow()
      .append(...head.map((t) => Object.assign(document.createElement('th'), { textContent: t })));
    const body = table.createTBody();
    for (const e of entries.slice().reverse()) {
      const row = body.insertRow();
      const cells = [
        new Date(e.tijd).toLocaleString('nl-NL'),
        e.videoId,
        e.stap,
        e.provider,
        e.model,
        e.invoerTekens.toLocaleString('nl-NL'),
        `${(e.duurMs / 1000).toFixed(1)} s`,
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
  });
  $('#clear-log').addEventListener('click', async () => {
    await send({ type: 'clearDebugLog' });
    $('#log').hidden = true;
  });
}

const SAMPLE: Record<string, string> = {
  nl: 'Dit is een voorbeeld van hoe de samenvatting klinkt.',
  en: 'This is an example of how the summary sounds.',
  de: 'Dies ist ein Beispiel dafür, wie die Zusammenfassung klingt.',
  fr: 'Voici un exemple de la façon dont le résumé sonne.',
  es: 'Este es un ejemplo de cómo suena el resumen.',
  it: 'Questo è un esempio di come suona il riassunto.',
  pt: 'Este é um exemplo de como o resumo soa.',
};

async function initSpeech(initial: Settings): Promise<void> {
  const select = $<HTMLSelectElement>('#stem');
  const hint = $('#stem-hint');
  const rate = $<HTMLInputElement>('#spreeksnelheid');
  const rateOut = $<HTMLOutputElement>('#spreeksnelheid-waarde');
  const test = $<HTMLButtonElement>('#test-stem');
  const showRate = (v: number) => (rateOut.textContent = `${v.toFixed(2).replace('.', ',')}×`);
  rate.value = String(initial.spreeksnelheid);
  showRate(initial.spreeksnelheid);

  if (!speaker.available) {
    select.disabled = true;
    test.disabled = true;
    hint.textContent = 'Voorlezen wordt niet ondersteund in deze browser.';
    return;
  }
  const voices = await speaker.voices();

  const fill = (s: Settings) => {
    const chosen = pickVoice(voices, s.stemmen[s.taal], s.taal);
    const groups = groupVoices(voices, s.taal, languageName(s.taal));
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
    const mine = groups.find((g) => g.label === languageName(s.taal))?.voices.length ?? 0;
    hint.textContent =
      voices.length === 0
        ? 'Geen stemmen gevonden; de standaardstem van de browser wordt gebruikt.'
        : mine === 0
          ? `Geen stem voor het ${languageName(s.taal)} gevonden in deze browser. Installeer in Windows het taalpakket (Instellingen › Tijd en taal › Spraak) of gebruik Edge.`
          : `${mine} ${mine === 1 ? 'stem' : 'stemmen'} in het ${languageName(s.taal)}; stemmen verschillen per browser.`;
  };
  fill(initial);
  // The summary language decides which voice is shown as chosen.
  $<HTMLSelectElement>('#taal').addEventListener('change', async () => fill(await getSettings()));

  select.addEventListener('change', async () => {
    const cur = await getSettings();
    await save({ stemmen: { ...cur.stemmen, [cur.taal]: select.value } });
  });
  rate.addEventListener('input', () => showRate(Number(rate.value)));
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
    test.textContent = 'Stoppen';
    speaker.play([{ id: 'kritiek', text: SAMPLE[lang] ?? SAMPLE.nl! }], {
      voice,
      lang: cur.taal,
      rate: Number(rate.value),
      onItem: () => undefined,
      onEnd: () => {
        testing = false;
        test.textContent = 'Test stem';
      },
    });
  });
}

function markActive(p: ProviderId): void {
  document.querySelectorAll<HTMLElement>('section[data-provider]').forEach((sec) => {
    sec.classList.toggle('inactive', sec.dataset.provider !== p);
  });
}

void init();
