import { applyRefinement, findRefinement } from '../engine/refinements';
import type { Moment, RefinementSuggestion, Summary, Takeaway } from '../engine/types';
import type { ErrorInfo, SummaryStep } from '../job';
import { errorMessage, messages, type Messages } from '../i18n/messages';
import { groupVoices, voiceLabel, type SpeechId, type VoiceLike } from './speechText';
import { leadSeconds, type SeekMargin } from '../seek';
import { ICONS } from './styles';
import { summaryToText } from './summaryText';

export type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading'; stap: SummaryStep; provider?: string; deel?: number; delen?: number }
  | {
      kind: 'done';
      summary: Summary;
      fromCache: boolean;
      /** A refinement is running; the summary stays visible. */
      refining?: { label: string };
      /** The last refinement failed. */
      refineError?: ErrorInfo;
    }
  | { kind: 'error'; error: ErrorInfo }
  | { kind: 'confirm'; minuten: number };

export interface ViewHandlers {
  /**
   * `seconds` is where the jump starts (the marker minus the lead from `seekMargin`);
   * `id` tells which line the time belongs to: the critical point or a takeaway index.
   */
  onSeek: (seconds: number, id: SpeechId) => void;
  onStart: () => void;
  onConfirm: () => void;
  onOpenOptions: () => void;
  /** No API key yet: opens the setup guide; without it the button opens the settings. */
  onSetup?: () => void;
  /** Header button; omitted handler hides the button. */
  onClose?: () => void;
  /** Autoplay gate ("Toch bekijken"). */
  onWatchAnyway?: () => void;
  /** Read aloud; omitted handlers hide the controls. */
  onSpeak?: (from?: SpeechId) => void;
  onStopSpeak?: () => void;
  onVoiceChange?: (voiceUri: string) => void;
  /** On/off switch in the header; omitted handler hides the switch. */
  onToggleEnabled?: (on: boolean) => void;
  /** Copy button under a summary; gets the plain text. Omitted handler hides the button. */
  onCopy?: (text: string) => Promise<void> | void;
  /** Refine the takeaways with an instruction; omitted handler hides the refine block. */
  onRefine?: (instructie: string, label?: string) => void;
  /** Switch between the original takeaways (null) and a refinement. */
  onSelectRefinement?: (id: string | null) => void;
}

export interface ViewOptions {
  collapsed?: boolean;
  gateActive?: boolean;
  /** Label next to the time buttons ("Spring naar" vs "Open op"). */
  seekLabel?: string;
  /** How much earlier a jump starts (setting springMarge); 'slim' when omitted. */
  seekMargin?: SeekMargin;
  /** More takeaways than this: show this many and scroll the rest. Omitted = the full list. */
  scrollAfter?: number;
  /** Interface texts; Dutch when omitted. */
  t?: Messages;
  speech?: SpeechView;
  /** False: The Point is switched off; only the header with the switch is shown. */
  enabled?: boolean;
  /** Id of the refinement shown instead of the original takeaways. */
  activeRefinement?: string | null;
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

function providerName(p: string | undefined): string {
  return p === 'gemini' ? 'Gemini' : p === 'claude' ? 'Claude' : 'AI';
}

function iconButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  return h('button', { class: 'icon-btn', title: label, 'aria-label': label, html: icon, onClick });
}

/** What every time button needs to jump. */
interface SeekContext {
  handlers: ViewHandlers;
  label: string;
  margin: SeekMargin;
  v: Messages['view'];
}

/** Shows the marker itself; the jump starts `leadSeconds` earlier (data-start). */
function timeButton(
  tijd: string,
  seconden: number,
  moment: Moment | undefined,
  id: SpeechId,
  seek: SeekContext,
): HTMLButtonElement {
  const lead = Math.min(leadSeconds(moment, seek.margin), seconden);
  const text =
    lead > 0 ? `${seek.label} ${tijd} (${seek.v.leadIn(lead)})` : `${seek.label} ${tijd}`;
  return h(
    'button',
    {
      class: 'time',
      title: text,
      'aria-label': text,
      'data-start': String(seconden - lead),
      onClick: (e: Event) => {
        e.stopPropagation();
        seek.handlers.onSeek(seconden - lead, id);
      },
    },
    tijd,
  );
}

/** Speaking item per view, to scroll a newly read takeaway into the scrolling list's view. */
const lastSpeaking = new WeakMap<HTMLElement, SpeechId | null>();

export function renderView(
  root: HTMLElement,
  state: ViewState,
  handlers: ViewHandlers,
  opts: ViewOptions = {},
): void {
  const t = opts.t ?? messages('nl');
  const v = t.view;
  const seek: SeekContext = {
    handlers,
    label: opts.seekLabel ?? v.seekTo,
    margin: opts.seekMargin ?? 'slim',
    v,
  };
  const enabled = opts.enabled !== false;
  const headerButtons: Node[] = [];
  if (handlers.onToggleEnabled) {
    const toggle = handlers.onToggleEnabled;
    const label = enabled ? v.turnOff : v.turnOn;
    headerButtons.push(
      h(
        'button',
        {
          class: 'switch',
          role: 'switch',
          'aria-checked': String(enabled),
          'aria-label': v.switchAria,
          title: label,
          onClick: () => toggle(!enabled),
        },
        h('span', { class: 'knob' }),
      ),
    );
  }
  if (handlers.onClose) headerButtons.push(iconButton(ICONS.close, v.close, handlers.onClose));

  const badge = enabled && state.kind === 'done' ? v.videoType[state.summary.videoType] : null;
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

  if (!enabled) {
    card.append(h('p', { class: 'off' }, v.off));
    root.replaceChildren(card);
    return;
  }

  if (opts.gateActive && state.kind !== 'done') {
    card.append(
      h(
        'div',
        { class: 'gate' },
        h('span', {}, v.gatePaused),
        handlers.onWatchAnyway
          ? h('button', { class: 'btn', onClick: handlers.onWatchAnyway }, v.watchAnyway)
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
            v.summarize,
          ),
        ),
      );
      break;

    case 'loading': {
      let text = v.steps[state.stap];
      if (state.stap === 'samenvatten') text = v.summarizingWith(providerName(state.provider));
      if (state.stap === 'deel' && state.delen)
        text = `${v.steps.deel} (${state.deel ?? 0}/${state.delen})…`;
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
        h('div', { class: 'notice' }, v.confirmNoTranscript(state.minuten)),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn primary', onClick: handlers.onConfirm }, v.confirmYes),
        ),
      );
      break;

    case 'error': {
      const e = state.error;
      // No key yet is a step still to take, not an error: a friendly card with one button.
      if (e.code === 'no_key') {
        card.append(
          h(
            'div',
            { class: 'setup' },
            h('p', { class: 'setup-title' }, v.noKeyTitle),
            h('p', {}, v.noKeyText),
          ),
          h(
            'div',
            { class: 'actions' },
            h(
              'button',
              { class: 'btn primary', onClick: handlers.onSetup ?? handlers.onOpenOptions },
              v.noKeyButton,
            ),
          ),
          h('div', { class: 'peek' }, v.noKeyTitle),
        );
        break;
      }
      const actions = h('div', { class: 'actions' });
      if (e.action === 'options')
        actions.append(
          h('button', { class: 'btn primary', onClick: handlers.onOpenOptions }, v.openSettings),
        );
      if (e.action === 'retry' || !e.action)
        actions.append(h('button', { class: 'btn', onClick: handlers.onStart }, v.retry));
      const message = errorMessage(e, t);
      card.append(h('div', { class: 'error-msg', role: 'alert' }, message), actions);
      if (e.details)
        card.append(
          h('details', {}, h('summary', {}, v.details), h('pre', {}, `${e.code}: ${e.details}`)),
        );
      card.append(h('div', { class: 'peek' }, message));
      break;
    }

    case 'done': {
      const s = state.summary;
      const active = handlers.onSelectRefinement ? findRefinement(s, opts.activeRefinement) : null;
      const shown = applyRefinement(s, active?.id);
      const body = h('div', { class: 'body' });
      const speech = handlers.onSpeak ? opts.speech : undefined;
      if (speech) body.append(renderSpeechBar(speech, handlers, t));
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
                  s.kritiekPunt.moment,
                  'kritiek',
                  seek,
                ),
              )
            : null,
        ),
      );
      if (handlers.onSelectRefinement && s.verfijnd?.length)
        body.append(renderTabs(s, active?.id ?? null, handlers.onSelectRefinement, v));
      if (active) {
        body.append(h('p', { class: 'instruction' }, v.instruction(active.instructie)));
        if (active.toelichting) body.append(h('p', { class: 'instruction' }, active.toelichting));
      }
      if (shown.takeaways.length > 0) {
        body.append(h('div', { class: 'section-label' }, v.takeaways(shown.takeaways.length)));
        const scroll = !!opts.scrollAfter && shown.takeaways.length > opts.scrollAfter;
        const list = h('ul', { class: scroll ? 'takeaways scroll' : 'takeaways' });
        shown.takeaways.forEach((item, i) =>
          list.append(renderTakeaway(item, i, handlers, seek, v, speech)),
        );
        body.append(list);
      } else {
        body.append(h('p', { class: 'empty' }, v.noTakeaways));
      }
      body.append(
        h(
          'div',
          { class: 'oordeel' },
          h('b', {}, v.density[s.inhoudsoordeel.dichtheid]),
          ` · ${s.inhoudsoordeel.toelichting}`,
        ),
      );
      if (handlers.onCopy)
        body.append(h('div', { class: 'tools' }, copyButton(shown, handlers.onCopy, t)));
      if (handlers.onRefine) body.append(renderRefine(state, handlers, t));
      if (s.isInterview) body.append(h('div', { class: 'meta' }, v.interview));
      if (s.bron === 'gemini_video') {
        body.append(h('div', { class: 'notice' }, v.madeWithoutTranscript));
      } else if (s.transcriptKwaliteit === 'slecht') {
        body.append(h('div', { class: 'notice' }, v.poorTranscript));
      }
      const datum = new Date(s.aangemaaktOp);
      body.append(
        h(
          'div',
          { class: 'meta' },
          h('span', {}, s.bron === 'transcript' ? v.sourceTranscript : v.sourceVideo),
          h('span', {}, `${providerName(s.provider)} · ${s.model}`),
          h(
            'span',
            { title: datum.toLocaleString(t.locale) },
            state.fromCache ? v.fromCache(datum.toLocaleDateString(t.locale)) : v.justNow,
          ),
        ),
      );
      card.append(body, h('div', { class: 'peek' }, s.kritiekPunt.zin));
      break;
    }
  }

  // Re-rendering replaces the list; keep where the user had scrolled to.
  const scrollTop = root.querySelector('ul.takeaways.scroll')?.scrollTop ?? 0;
  // ...and what the user was typing in the refine field.
  const oldInput = root.querySelector<HTMLInputElement>('input.refine-input');
  const typed = oldInput?.value ?? '';
  const focused = !!oldInput && isFocused(root, oldInput);
  root.replaceChildren(card);
  const newInput = root.querySelector<HTMLInputElement>('input.refine-input');
  if (newInput && typed && !newInput.value) newInput.value = typed;
  if (newInput && focused && !newInput.disabled) newInput.focus();
  const list = root.querySelector<HTMLElement>('ul.takeaways.scroll');
  if (list) {
    fitScrollList(list, opts.scrollAfter ?? 0);
    list.scrollTop = scrollTop;
    const speakingId = opts.speech?.speakingId ?? null;
    if (speakingId !== lastSpeaking.get(root)) {
      const item = list.querySelector<HTMLElement>('li.speaking');
      if (item) scrollIntoList(list, item);
    }
  }
  lastSpeaking.set(root, opts.speech?.speakingId ?? null);
}

/** Copies the summary as plain text; the label says "Gekopieerd" for a moment. */
function copyButton(
  s: Summary,
  onCopy: NonNullable<ViewHandlers['onCopy']>,
  t: Messages,
): HTMLButtonElement {
  const v = t.view;
  const label = h('span', {}, v.copy);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const button: HTMLButtonElement = h(
    'button',
    {
      class: 'btn small copy',
      html: ICONS.copy,
      onClick: async () => {
        clearTimeout(timer);
        try {
          await onCopy(summaryToText(s, t));
          label.textContent = v.copied;
          button.classList.add('done');
        } catch {
          label.textContent = v.copyFailed;
        }
        timer = setTimeout(() => {
          label.textContent = v.copy;
          button.classList.remove('done');
        }, 2000);
      },
    },
    label,
  );
  return button;
}

/** Limits the list to exactly `visible` items, also when the panel changes width. */
function fitScrollList(list: HTMLElement, visible: number): void {
  const fit = () => {
    const first = list.children[0] as HTMLElement | undefined;
    const last = list.children[visible - 1] as HTMLElement | undefined;
    if (!first || !last) return;
    const height = last.offsetTop + last.offsetHeight - first.offsetTop;
    // Zero while collapsed or hidden: keep the CSS fallback.
    if (height > 0) list.style.maxHeight = `${height}px`;
  };
  fit();
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => {
    if (list.isConnected) fit();
    else observer.disconnect();
  });
  observer.observe(list);
}

/** Scrolls the list (not the page) just enough to show the item. */
function scrollIntoList(list: HTMLElement, item: HTMLElement): void {
  const top = item.offsetTop - (list.children[0] as HTMLElement).offsetTop;
  const bottom = top + item.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

function renderSpeechBar(speech: SpeechView, handlers: ViewHandlers, t: Messages): HTMLElement {
  const v = t.view;
  const reading = speech.speakingId !== null;
  const bar = h('div', { class: 'tts' });
  if (!speech.available) {
    bar.append(h('span', { class: 'tts-note' }, v.ttsUnsupported));
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
      reading ? v.stop : v.readAloud,
    ),
  );
  if (speech.voices.length === 0) {
    bar.append(h('span', { class: 'tts-note' }, v.noVoices));
    return bar;
  }
  const select = h('select', {
    class: 'tts-voice',
    'aria-label': v.voice,
    title: v.voiceTitle,
    onChange: (e: Event) => handlers.onVoiceChange?.((e.target as HTMLSelectElement).value),
  });
  const taalNaam = t.languageNames[speech.taal] ?? speech.taal;
  for (const group of groupVoices(speech.voices, speech.taal, taalNaam, v.otherLanguages)) {
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
  seek: SeekContext,
  v: Messages['view'],
  speech?: SpeechView,
): HTMLLIElement {
  const zin = h('div', { class: 'zin', title: t.citaat ? v.quote(t.citaat) : undefined }, t.zin);
  if (t.zekerheid !== 'feit') zin.append(h('span', { class: 'label' }, v.zekerheid[t.zekerheid]));
  if (t.afgeleid) zin.append(h('span', { class: 'label', title: v.derivedTitle }, v.derived));
  if (t.nieuw) zin.append(h('span', { class: 'label nieuw', title: v.newPointTitle }, v.newPoint));
  if (t.onbevestigd) {
    zin.append(
      h('span', {
        class: 'warn',
        role: 'img',
        'aria-label': v.unconfirmedAria,
        title: v.unconfirmedTitle,
        html: ICONS.warn,
      }),
    );
  }
  if (t.aanvulling?.length)
    zin.append(h('ul', { class: 'aanvulling' }, ...t.aanvulling.map((r) => h('li', {}, r))));
  const speaking = speech?.speakingId === index;
  const speak =
    speech?.available && handlers.onSpeak
      ? h('button', {
          class: speaking ? 'speak-btn active' : 'speak-btn',
          title: speaking ? v.stop : v.readFromHere,
          'aria-label': speaking ? v.stop : v.readFromPoint(index + 1),
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
    timeButton(t.tijd, t.seconden, t.moment, index, seek),
    zin,
    speak,
  );
}

/** Is the element focused, in the page or inside the shadow root that holds it? */
function isFocused(root: HTMLElement, el: HTMLElement): boolean {
  const node = root.getRootNode() as Document | ShadowRoot;
  return node.activeElement === el || document.activeElement === el;
}

/** "Oorspronkelijk" plus one tab per refinement. */
function renderTabs(
  s: Summary,
  activeId: string | null,
  onSelect: (id: string | null) => void,
  v: Messages['view'],
): HTMLElement {
  const tab = (id: string | null, label: string, title?: string) =>
    h(
      'button',
      {
        class: 'refine-tab',
        role: 'tab',
        'aria-selected': String(activeId === id),
        'data-refinement': id ?? '',
        title: title ?? label,
        onClick: () => onSelect(id),
      },
      label,
    );
  return h(
    'div',
    { class: 'refine-tabs', role: 'tablist', 'aria-label': v.tabsAria },
    tab(null, v.original),
    ...(s.verfijnd ?? []).map((r) => tab(r.id, r.label, r.instructie)),
  );
}

/** The refine block under the list: suggestion buttons, a text field and the status. */
function renderRefine(
  state: Extract<ViewState, { kind: 'done' }>,
  handlers: ViewHandlers,
  t: Messages,
): HTMLElement {
  const v = t.view;
  const s = state.summary;
  const busy = !!state.refining;
  const onRefine = handlers.onRefine!;
  const done = new Map((s.verfijnd ?? []).map((r) => [r.instructie.toLowerCase(), r.id]));
  const suggestions: RefinementSuggestion[] = s.verfijningen?.length
    ? s.verfijningen
    : v.refineDefaults;

  const chips = h(
    'div',
    { class: 'refine-chips' },
    ...suggestions.map((x) => {
      const existing = done.get(x.instructie.toLowerCase());
      return h(
        'button',
        {
          class: existing ? 'btn small done' : 'btn small',
          title: x.instructie,
          disabled: busy,
          onClick: () =>
            existing && handlers.onSelectRefinement
              ? handlers.onSelectRefinement(existing)
              : onRefine(x.instructie, x.label),
        },
        x.label,
      );
    }),
  );

  const input = h('input', {
    class: 'refine-input',
    type: 'text',
    maxlength: '500',
    placeholder: v.refinePlaceholder,
    'aria-label': v.refineTitle,
    disabled: busy,
  });
  const form = h(
    'form',
    {
      class: 'refine-form',
      onSubmit: (e: Event) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || busy) return;
        input.value = '';
        onRefine(text);
      },
    },
    input,
    h('button', { class: 'btn primary', type: 'submit', disabled: busy }, v.refineButton),
  );

  const block = h(
    'div',
    { class: 'refine' },
    h('div', { class: 'section-label' }, v.refineTitle),
    h('p', { class: 'refine-hint' }, v.refineHint),
    chips,
    form,
  );
  if (state.refining) {
    block.append(
      h(
        'div',
        { class: 'refine-status', role: 'status' },
        h('span', { class: 'spinner' }),
        v.refining(state.refining.label),
      ),
    );
  } else if (state.refineError) {
    const e = state.refineError;
    block.append(
      h(
        'div',
        { class: 'refine-error', role: 'alert' },
        `${v.refineFailed}: ${errorMessage(e, t)}`,
      ),
    );
    if (e.details)
      block.append(
        h('details', {}, h('summary', {}, v.details), h('pre', {}, `${e.code}: ${e.details}`)),
      );
  }
  return block;
}
