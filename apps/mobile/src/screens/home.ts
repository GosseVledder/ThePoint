// Start screen: paste a link, or open one of the recent summaries.
import { h } from '@the-point/core/ui/render';
import { summaryHash, type App, type Screen } from '../app';
import { videoFromShare } from '../share';
import type { RecentEntry } from '../storage/stores';

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function homeScreen(app: App): Screen {
  const input = h('input', {
    type: 'url',
    placeholder: 'Plak een YouTube-link',
    'aria-label': 'YouTube-link of video-ID',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const error = h('p', { class: 'error', 'aria-live': 'polite' });
  const open = () => {
    const v = videoFromShare(input.value);
    if (v) app.go(summaryHash(v.videoId, v.start));
    else error.textContent = 'Geen YouTube-video herkend in deze link.';
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
      h('p', { class: 'hint' }, 'Tik in de YouTube-app op ', h('b', {}, 'Delen → The Point'), '.'),
      h(
        'div',
        { class: 'row' },
        input,
        h('button', { class: 'primary', onClick: open }, 'Samenvatten'),
      ),
      error,
    ),
    h('h2', {}, 'Recent'),
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
        h('span', {}, 'Vul eerst een API-sleutel in.'),
        h('button', { onClick: () => app.go('#/instellingen') }, 'Instellingen'),
      );
    }
    list.replaceChildren(
      ...(recent.length
        ? recent.map((e) => recentItem(app, e))
        : [h('li', { class: 'empty' }, 'Nog geen samenvattingen.')]),
    );
  })();

  return { title: 'The Point', el };
}

function recentItem(app: App, e: RecentEntry): HTMLLIElement {
  const when = Number.isNaN(Date.parse(e.op)) ? '' : dateFmt.format(new Date(e.op));
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
