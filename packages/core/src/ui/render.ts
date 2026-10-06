import type { Summary, Takeaway } from '../engine/types';
import type { ErrorInfo, SummaryStep } from '../job';
import { languageName } from '../engine/prompt';
import { groupVoices, voiceLabel, type SpeechId, type VoiceLike } from './speechText';
import { ICONS } from './styles';

export type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading'; stap: SummaryStep; provider?: string; deel?: number; delen?: number }
  | { kind: 'done'; summary: Summary; fromCache: boolean }
  | { kind: 'error'; error: ErrorInfo }
  | { kind: 'confirm'; minuten: number };

export interface ViewHandlers {
  /** `id` tells which line the time belongs to: the critical point or a takeaway index. */
  onSeek: (seconds: number, id: SpeechId) => void;
  onStart: () => void;
  onRefresh: () => void;
  onConfirm: () => void;
  onOpenOptions: () => void;
  /** Header buttons; omitted handlers hide the button. */
  onToggleCollapse?: () => void;
  onClose?: () => void;
  /** Autoplay gate ("Toch bekijken"). */
  onWatchAnyway?: () => void;
  /** Read aloud; omitted handlers hide the controls. */
  onSpeak?: (from?: SpeechId) => void;
  onStopSpeak?: () => void;
  onVoiceChange?: (voiceUri: string) => void;
}

export interface ViewOptions {
  collapsed?: boolean;
  gateActive?: boolean;
  /** Label next to the time buttons ("Spring naar" vs "Open op"). */
  seekLabel?: string;
  speech?: SpeechView;
}

export interface SpeechView {
  available: boolean;
  speakingId: SpeechId | null;
  voices: VoiceLike[];
  voiceUri: string | null;
  /** Summary language, to group the voices. */
  taal: string;
}

type Child = Node | string | null | undefined | false;

/** Minimal element builder. Text is always set as text, never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'html') {
      // Only used for our own static SVG icons.
      el.innerHTML = String(value);
    } else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

const STEP_TEXT: Record<SummaryStep, string> = {
  cache: 'Bezig…',
  transcript: 'Transcript ophalen…',
  samenvatten: 'Samenvatten',
  deel: 'Lange video: delen samenvatten',
  samenvoegen: 'Delen samenvoegen…',
  herstel: 'Antwoord herstellen…',
  video: 'Gemini bekijkt de video (dit duurt langer)…',
};

const ZEKERHEID_TEXT: Record<Takeaway['zekerheid'], string> = {
  feit: 'feit',
  bewering: 'bewering',
  mening: 'mening',
  gerucht: 'gerucht',
};

const VIDEOTYPE_TEXT: Record<Summary['videoType'], string> = {
  nieuwsoverzicht: 'Nieuwsoverzicht',
  uitleg: 'Uitleg',
  tutorial: 'Tutorial',
  interview: 'Interview',
  opinie: 'Opinie',
  review: 'Review',
  overig: 'Video',
};

const DICHTHEID_TEXT = {
  hoog: 'Veel inhoud',
  gemiddeld: 'Gemiddeld veel inhoud',
  laag: 'Weinig inhoud',
};

function providerName(p: string | undefined): string {
  return p === 'gemini' ? 'Gemini' : p === 'claude' ? 'Claude' : 'AI';
}

function iconButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  return h('button', { class: 'icon-btn', title: label, 'aria-label': label, html: icon, onClick });
}

function timeButton(
  tijd: string,
  seconden: number,
  id: SpeechId,
  handlers: ViewHandlers,
  label: string,
): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'time',
      title: `${label} ${tijd}`,
      'aria-label': `${label} ${tijd}`,
      onClick: (e: Event) => {
        e.stopPropagation();
        handlers.onSeek(seconden, id);
      },
    },
    tijd,
  );
}

export function renderView(
  root: HTMLElement,
  state: ViewState,
  handlers: ViewHandlers,
  opts: ViewOptions = {},
): void {
  const seekLabel = opts.seekLabel ?? 'Spring naar';
  const headerButtons: Node[] = [];
  if (state.kind === 'done')
    headerButtons.push(iconButton(ICONS.refresh, 'Opnieuw samenvatten', handlers.onRefresh));
  if (handlers.onToggleCollapse) {
    headerButtons.push(
      iconButton(
        opts.collapsed ? ICONS.chevronDown : ICONS.chevronUp,
        opts.collapsed ? 'Uitklappen' : 'Inklappen',
        handlers.onToggleCollapse,
      ),
    );
  }
  if (handlers.onClose) headerButtons.push(iconButton(ICONS.close, 'Sluiten', handlers.onClose));

  const badge = state.kind === 'done' ? VIDEOTYPE_TEXT[state.summary.videoType] : null;
  const header = h(
    'div',
    { class: 'head' },
    h(
      'div',
      { class: 'title', role: 'heading', 'aria-level': '2' },
      'The Point',
      badge ? h('span', { class: 'badge' }, badge) : null,
    ),
    ...headerButtons,
  );

  const card = h(
    'div',
    { class: `card${opts.collapsed ? ' collapsed' : ''}`, 'aria-live': 'polite' },
    header,
  );

  if (opts.gateActive && state.kind !== 'done') {
    card.append(
      h(
        'div',
        { class: 'gate' },
        h('span', {}, 'Video gepauzeerd tot de samenvatting klaar is.'),
        handlers.onWatchAnyway
          ? h('button', { class: 'btn', onClick: handlers.onWatchAnyway }, 'Toch bekijken')
          : null,
      ),
    );
  }

  switch (state.kind) {
    case 'idle':
      card.append(
        h(
          'div',
          { class: 'actions' },
          h(
            'button',
            { class: 'btn primary', onClick: handlers.onStart, html: ICONS.logo },
            'Samenvatten',
          ),
        ),
      );
      break;

    case 'loading': {
      let text = STEP_TEXT[state.stap];
      if (state.stap === 'samenvatten') text = `Samenvatten met ${providerName(state.provider)}…`;
      if (state.stap === 'deel' && state.delen)
        text = `${STEP_TEXT.deel} (${state.deel ?? 0}/${state.delen})…`;
      card.append(
        h(
          'div',
          { class: 'loading', role: 'status' },
          h('div', { class: 'step' }, h('span', { class: 'spinner' }), text),
          h('div', { class: 'bar w90' }),
          h('div', { class: 'bar w80' }),
          h('div', { class: 'bar w60' }),
        ),
        h('div', { class: 'peek' }, text),
      );
      break;
    }

    case 'confirm':
      card.append(
        h(
          'div',
          { class: 'notice' },
          `Deze video heeft geen transcript. Gemini kan de video zelf bekijken, maar dat is trager en duurder (${state.minuten} minuten video). Doorgaan?`,
        ),
        h(
          'div',
          { class: 'actions' },
          h(
            'button',
            { class: 'btn primary', onClick: handlers.onConfirm },
            'Ja, analyseer de video',
          ),
        ),
      );
      break;

    case 'error': {
      const e = state.error;
      const actions = h('div', { class: 'actions' });
      if (e.action === 'options')
        actions.append(
          h(
            'button',
            { class: 'btn primary', onClick: handlers.onOpenOptions },
            'Instellingen openen',
          ),
        );
      if (e.action === 'retry' || !e.action)
        actions.append(
          h('button', { class: 'btn', onClick: handlers.onRefresh }, 'Opnieuw proberen'),
        );
      card.append(h('div', { class: 'error-msg', role: 'alert' }, e.message), actions);
      if (e.details)
        card.append(
          h('details', {}, h('summary', {}, 'Details'), h('pre', {}, `${e.code}: ${e.details}`)),
        );
      card.append(h('div', { class: 'peek' }, e.message));
      break;
    }

    case 'done': {
      const s = state.summary;
      const body = h('div', { class: 'body' });
      const speech = handlers.onSpeak ? opts.speech : undefined;
      if (speech) body.append(renderSpeechBar(speech, handlers));
      body.append(
        h(
          'p',
          { class: speech?.speakingId === 'kritiek' ? 'kritiek speaking' : 'kritiek' },
          s.kritiekPunt.zin,
          s.kritiekPunt.tijd !== null && s.kritiekPunt.seconden !== null
            ? h(
                'span',
                {},
                ' ',
                timeButton(
                  s.kritiekPunt.tijd,
                  s.kritiekPunt.seconden,
                  'kritiek',
                  handlers,
                  seekLabel,
                ),
              )
            : null,
        ),
      );
      if (s.takeaways.length > 0) {
        body.append(h('div', { class: 'section-label' }, `Takeaways (${s.takeaways.length})`));
        const list = h('ul', { class: 'takeaways' });
        s.takeaways.forEach((t, i) =>
          list.append(renderTakeaway(t, i, handlers, seekLabel, speech)),
        );
        body.append(list);
      } else {
        body.append(h('p', { class: 'empty' }, 'Geen inhoudelijke takeaways gevonden.'));
      }
      body.append(
        h(
          'div',
          { class: 'oordeel' },
          h('b', {}, DICHTHEID_TEXT[s.inhoudsoordeel.dichtheid]),
          ` · ${s.inhoudsoordeel.toelichting}`,
        ),
      );
      if (s.isInterview) body.append(h('div', { class: 'meta' }, 'Dit is een interview.'));
      if (s.bron === 'gemini_video') {
        body.append(
          h(
            'div',
            { class: 'notice' },
            'Gemaakt zonder transcript: Gemini heeft de video zelf bekeken. Citaten zijn niet te controleren.',
          ),
        );
      } else if (s.transcriptKwaliteit === 'slecht') {
        body.append(
          h(
            'div',
            { class: 'notice' },
            'Het transcript is van slechte kwaliteit; controleer belangrijke punten in de video.',
          ),
        );
      }
      const datum = new Date(s.aangemaaktOp);
      body.append(
        h(
          'div',
          { class: 'meta' },
          h('span', {}, s.bron === 'transcript' ? 'Bron: transcript' : 'Bron: video (Gemini)'),
          h('span', {}, `${providerName(s.provider)} · ${s.model}`),
          h(
            'span',
            { title: datum.toLocaleString('nl-NL') },
            state.fromCache
              ? `Uit cache · ${datum.toLocaleDateString('nl-NL')}`
              : 'Zojuist gemaakt',
          ),
        ),
      );
      card.append(body, h('div', { class: 'peek' }, s.kritiekPunt.zin));
      break;
    }
  }

  root.replaceChildren(card);
}

function renderSpeechBar(speech: SpeechView, handlers: ViewHandlers): HTMLElement {
  const reading = speech.speakingId !== null;
  const bar = h('div', { class: 'tts' });
  if (!speech.available) {
    bar.append(
      h('span', { class: 'tts-note' }, 'Voorlezen wordt niet ondersteund in deze browser.'),
    );
    return bar;
  }
  bar.append(
    h(
      'button',
      {
        class: reading ? 'btn tts-play active' : 'btn tts-play',
        'aria-pressed': String(reading),
        html: reading ? ICONS.stop : ICONS.speaker,
        onClick: () => (reading ? handlers.onStopSpeak?.() : handlers.onSpeak?.()),
      },
      reading ? 'Stoppen' : 'Voorlezen',
    ),
  );
  if (speech.voices.length === 0) {
    bar.append(
      h(
        'span',
        { class: 'tts-note' },
        'Geen stemmen beschikbaar; de standaardstem wordt gebruikt.',
      ),
    );
    return bar;
  }
  const select = h('select', {
    class: 'tts-voice',
    'aria-label': 'Stem',
    title: 'Stem voor het voorlezen (wordt onthouden)',
    onChange: (e: Event) => handlers.onVoiceChange?.((e.target as HTMLSelectElement).value),
  });
  for (const group of groupVoices(speech.voices, speech.taal, languageName(speech.taal))) {
    const og = h('optgroup', { label: group.label });
    for (const v of group.voices) {
      og.append(
        h('option', { value: v.voiceURI, selected: v.voiceURI === speech.voiceUri }, voiceLabel(v)),
      );
    }
    select.append(og);
  }
  bar.append(select);
  return bar;
}

function renderTakeaway(
  t: Takeaway,
  index: number,
  handlers: ViewHandlers,
  seekLabel: string,
  speech?: SpeechView,
): HTMLLIElement {
  const zin = h(
    'div',
    { class: 'zin', title: t.citaat ? `Citaat: “${t.citaat}”` : undefined },
    t.zin,
  );
  if (t.zekerheid !== 'feit')
    zin.append(h('span', { class: 'label' }, ZEKERHEID_TEXT[t.zekerheid]));
  if (t.afgeleid)
    zin.append(
      h(
        'span',
        { class: 'label', title: 'Verhouding berekend uit twee getallen in de video' },
        'berekend',
      ),
    );
  if (t.onbevestigd) {
    zin.append(
      h('span', {
        class: 'warn',
        role: 'img',
        'aria-label': 'Niet bevestigd in het transcript',
        title: 'Niet bevestigd: het citaat of een getal staat niet letterlijk in het transcript.',
        html: ICONS.warn,
      }),
    );
  }
  const speaking = speech?.speakingId === index;
  const speak =
    speech?.available && handlers.onSpeak
      ? h('button', {
          class: speaking ? 'speak-btn active' : 'speak-btn',
          title: speaking ? 'Stoppen' : 'Vanaf hier voorlezen',
          'aria-label': speaking ? 'Stoppen' : `Voorlezen vanaf punt ${index + 1}`,
          html: speaking ? ICONS.stop : ICONS.speaker,
          onClick: (e: Event) => {
            e.stopPropagation();
            if (speaking) handlers.onStopSpeak?.();
            else handlers.onSpeak?.(index);
          },
        })
      : null;
  return h(
    'li',
    { class: speaking ? 'speaking' : undefined },
    timeButton(t.tijd, t.seconden, index, handlers, seekLabel),
    zin,
    speak,
  );
}
