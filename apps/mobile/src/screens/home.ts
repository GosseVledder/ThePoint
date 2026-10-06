// Start screen: paste a link, or open one of the recent summaries.
import { h } from '@the-point/core/ui/render';
import { summaryHash, type App, type Screen } from '../app';
import { videoFromShare } from '../share';
import type { RecentEntry } from '../storage/stores';

const dateFmt = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function homeScreen(app: App): Screen {
  const t = app.t;
  const input = h('input', {
    type: 'url',
    placeholder: t.app.pastePlaceholder,
    'aria-label': t.app.linkAria,
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const error = h('p', { class: 'error', 'aria-live': 'polite' });
  const open = () => {
    const v = videoFromShare(input.value);
    if (v) app.go(summaryHash(v.videoId, v.start));
    else error.textContent = t.app.notRecognized;
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && open());

  const keyNotice = h('div', { class: 'notice', hidden: true });
  const list = h('ul', { class: 'recent' });
  const el = h(
    'div',
    { class: 'screen home' },
    keyNotice,
    h(
      'section',
      {},
      h(
        'p',
        { class: 'hint' },
        t.app.shareHint[0],
        h('b', {}, t.app.shareAction),
        t.app.shareHint[1],
      ),
      h(
        'div',
        { class: 'row' },
        input,
        h('button', { class: 'primary', onClick: open }, t.view.summarize),
      ),
      error,
    ),
    h('h2', {}, t.app.recent),
    list,
  );

  void (async () => {
    const [keys, settings, recent] = await Promise.all([
      app.keys.get(),
      app.settings.get(),
      app.cache.recent(),
    ]);
    if (!keys[settings.provider]) {
      keyNotice.hidden = false;
      keyNotice.replaceChildren(
        h('span', {}, t.settings.fillKeyFirst),
        h('button', { onClick: () => app.go('#/instellingen') }, t.app.settings),
      );
    }
    list.replaceChildren(
      ...(recent.length
        ? recent.map((e) => recentItem(app, e))
        : [h('li', { class: 'empty' }, t.app.noSummaries)]),
    );
  })();

  return { title: 'The Point', el };
}

function recentItem(app: App, e: RecentEntry): HTMLLIElement {
  const when = Number.isNaN(Date.parse(e.op)) ? '' : dateFmt(app.t.locale).format(new Date(e.op));
  return h(
    'li',
    {},
    h(
      'button',
      { class: 'item', onClick: () => app.go(summaryHash(e.videoId)) },
      h('img', {
        src: `https://i.ytimg.com/vi/${e.videoId}/mqdefault.jpg`,
        alt: '',
        loading: 'lazy',
      }),
      h('span', { class: 'text' }, h('b', {}, e.titel || e.videoId), h('small', {}, when)),
    ),
  );
}
