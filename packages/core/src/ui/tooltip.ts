// Tooltips for the ⓘ buttons on the settings pages (extension options and the app). One
// floating bubble per document, positioned against the viewport so cards with
// overflow:hidden never clip it. Hover and keyboard focus show it; a click or tap pins
// it (touch has no hover); Escape, a click elsewhere or leaving the page hides it.

export interface Tooltips {
  /** Wire an ⓘ button; `text` is read on every show, so it follows a language change. */
  bind(button: HTMLButtonElement, text: () => string): void;
  hide(): void;
}

const BUBBLE_ID = 'the-point-tooltip';
const GAP = 8;
const instances = new WeakMap<Document, Tooltips>();

export function tooltips(doc: Document = document): Tooltips {
  const existing = instances.get(doc);
  if (existing) return existing;

  const win = doc.defaultView ?? window;
  const bubble = doc.createElement('div');
  bubble.id = BUBBLE_ID;
  bubble.className = 'tooltip';
  bubble.setAttribute('role', 'tooltip');
  bubble.hidden = true;
  doc.body.append(bubble);

  let owner: HTMLButtonElement | null = null;
  let pinned = false;

  const place = (button: HTMLButtonElement) => {
    const r = button.getBoundingClientRect();
    bubble.style.maxWidth = `${Math.min(320, win.innerWidth - 2 * GAP)}px`;
    bubble.hidden = false;
    const b = bubble.getBoundingClientRect();
    const left = Math.max(
      GAP,
      Math.min(r.left + r.width / 2 - b.width / 2, win.innerWidth - b.width - GAP),
    );
    const below = r.bottom + GAP + b.height <= win.innerHeight - GAP;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${below ? r.bottom + GAP : Math.max(GAP, r.top - GAP - b.height)}px`;
  };

  const show = (button: HTMLButtonElement, text: string) => {
    if (owner && owner !== button) owner.setAttribute('aria-expanded', 'false');
    owner = button;
    bubble.textContent = text;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', BUBBLE_ID);
    place(button);
  };

  const hide = () => {
    owner?.setAttribute('aria-expanded', 'false');
    owner?.removeAttribute('aria-describedby');
    owner = null;
    pinned = false;
    bubble.hidden = true;
  };

  doc.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  doc.addEventListener('click', (e) => {
    if (owner && !owner.contains(e.target as Node)) hide();
  });
  // Follow the ⓘ while scrolling; close once it leaves the screen.
  const follow = () => {
    if (!owner) return;
    const r = owner.getBoundingClientRect();
    if (r.bottom < 0 || r.top > win.innerHeight) hide();
    else place(owner);
  };
  win.addEventListener('scroll', follow, { passive: true, capture: true });
  win.addEventListener('resize', hide);

  const api: Tooltips = {
    bind(button, text) {
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('mouseenter', () => !pinned && show(button, text()));
      button.addEventListener('mouseleave', () => !pinned && owner === button && hide());
      button.addEventListener('focus', () => show(button, text()));
      button.addEventListener('blur', () => owner === button && hide());
      button.addEventListener('click', (e) => {
        // Inside a <label> the click must not toggle the switch or focus the field.
        e.preventDefault();
        e.stopPropagation();
        if (owner === button && pinned) hide();
        else {
          show(button, text());
          pinned = true;
        }
      });
    },
    hide,
  };
  instances.set(doc, api);
  return api;
}
