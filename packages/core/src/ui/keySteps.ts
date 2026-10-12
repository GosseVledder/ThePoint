// "How do I get a key?" on the settings pages (extension options and the app): a
// collapsed step list per AI service under the key field, with the key page linked in
// the first step and a line about what the key costs.
import type { ProviderId } from '../engine/types';
import type { Messages } from '../i18n/messages';

/** Where a key for each service is created. */
export const KEY_URLS: Record<ProviderId, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  claude: 'https://console.anthropic.com/settings/keys',
};

export function keySteps(
  t: Messages,
  provider: ProviderId,
  doc: Document = document,
): HTMLDetailsElement {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const url = KEY_URLS[provider];
  const link = () =>
    Object.assign(el('a', new URL(url).hostname), {
      href: url,
      target: '_blank',
      rel: 'noreferrer',
    });

  const list = el('ol');
  for (const step of t.settings.keySteps[provider]) {
    const item = el('li');
    step.split('{site}').forEach((part, i) => {
      if (i > 0) item.append(link());
      item.append(part);
    });
    list.append(item);
  }

  const details = el('details');
  details.className = 'key-steps';
  details.append(
    el('summary', t.settings.keyStepsTitle),
    list,
    Object.assign(el('p', t.settings.keyCost[provider]), { className: 'key-cost' }),
  );
  return details;
}
