// History: every cached summary, newest first. A title opens the video on YouTube, where
// the panel loads the summary from the cache; "Verwijderen" removes one entry. Reads and
// deletes go through the background (listHistory / deleteCached), which content scripts
// may not send.
import { messages, type Messages } from '@the-point/core/i18n/messages';
import { watchUrl } from '@the-point/core/youtube/videoId';
import type { RuntimeRequest } from '../../messages';
import type { HistoryItem } from '../../storage/cache';
import { getSettings } from '../../storage/settings';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = <T>(msg: RuntimeRequest) => browser.runtime.sendMessage(msg) as Promise<T>;

let t: Messages = messages('nl');
let items: HistoryItem[] = [];
let statusTimer: number | undefined;

function flash(text: string): void {
  const el = $('#status');
  el.textContent = text;
  el.classList.add('show');
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => el.classList.remove('show'), 1500);
}

function meta(item: HistoryItem): string {
  const date = new Date(item.aangemaaktOp).toLocaleDateString(t.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const language = t.languageNames[item.taal] ?? item.taal;
  const provider = item.provider === 'claude' ? 'Claude' : 'Gemini';
  return [date, language, t.history.takeawayCount(item.takeaways), provider].join(' · ');
}

function row(item: HistoryItem): HTMLLIElement {
  const li = document.createElement('li');
  const text = document.createElement('div');
  text.className = 'item-text';
  const link = document.createElement('a');
  link.className = 'item-title';
  link.href = watchUrl(item.videoId);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = item.titel;
  const info = document.createElement('span');
  info.className = 'item-meta';
  info.textContent = meta(item);
  text.append(link, info);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn quiet';
  remove.textContent = t.history.delete;
  remove.setAttribute('aria-label', `${t.history.delete}: ${item.titel}`);
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    await send({ type: 'deleteCached', videoId: item.videoId, taal: item.taal });
    items = items.filter((i) => i !== item);
    render();
    flash(t.history.deleted);
  });
  li.append(text, remove);
  return li;
}

function render(): void {
  $('#count').textContent = items.length ? t.history.count(items.length) : '';
  $('#list').replaceChildren(...items.map(row));
  const empty = $('#empty');
  empty.hidden = items.length > 0;
  empty.textContent = t.history.empty;
}

async function init(): Promise<void> {
  const settings = await getSettings();
  t = messages(settings.interfaceTaal);
  document.documentElement.lang = t.locale.split('-')[0]!;
  document.title = `The Point – ${t.history.title}`;
  $('#subtitle').textContent = t.history.title;
  $('#h-history').textContent = t.history.title;
  $('#intro').textContent = t.history.intro;
  items = await send<HistoryItem[]>({ type: 'listHistory' });
  render();
}

void init();
