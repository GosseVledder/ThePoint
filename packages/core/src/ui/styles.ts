// Shared styles for every Shadow DOM root we inject. Tokens follow YouTube's own
// light and dark palette so the panel reads as part of the page.
export const BASE_CSS = `
:host {
  all: initial;
  --yt-bg: #ffffff;
  --yt-card: rgba(0, 0, 0, 0.05);
  --yt-card-hover: rgba(0, 0, 0, 0.1);
  --yt-text: #0f0f0f;
  --yt-text-2: #606060;
  --yt-border: rgba(0, 0, 0, 0.1);
  --yt-accent: #065fd4;
  --yt-accent-bg: #def1ff;
  --yt-warn: #b05a00;
  --yt-warn-bg: #fff4e5;
  --yt-error: #cc0000;
  --yt-chip: rgba(0, 0, 0, 0.08);
  --yt-mark: #ffcc00;
  --yt-shadow: 0 4px 32px rgba(0, 0, 0, 0.18);
  font-family: "Roboto", "Arial", sans-serif;
  color: var(--yt-text);
  font-size: 14px;
  line-height: 20px;
}
:host([data-theme="dark"]) {
  --yt-bg: #212121;
  --yt-card: rgba(255, 255, 255, 0.1);
  --yt-card-hover: rgba(255, 255, 255, 0.2);
  --yt-text: #f1f1f1;
  --yt-text-2: #aaaaaa;
  --yt-border: rgba(255, 255, 255, 0.2);
  --yt-accent: #3ea6ff;
  --yt-accent-bg: #263850;
  --yt-warn: #ffb74d;
  --yt-warn-bg: #3d2e14;
  --yt-error: #ff6b6b;
  --yt-chip: rgba(255, 255, 255, 0.15);
  --yt-shadow: 0 4px 32px rgba(0, 0, 0, 0.6);
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid var(--yt-accent); outline-offset: 2px; }

.card { background: var(--yt-card); border-radius: 12px; padding: 12px; }
.head { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.title { font-size: 16px; line-height: 22px; font-weight: 500; flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.title .badge { font-size: 11px; font-weight: 500; letter-spacing: .3px; padding: 1px 6px; border-radius: 4px; background: var(--yt-accent-bg); color: var(--yt-accent); }
.icon-btn { background: transparent; border: 0; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: var(--yt-text); flex: none; }
.icon-btn:hover { background: var(--yt-card-hover); }
.icon-btn svg { width: 20px; height: 20px; fill: currentColor; }
.btn { background: var(--yt-chip); border: 0; border-radius: 18px; padding: 0 14px; height: 32px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.btn:hover { background: var(--yt-card-hover); }
.btn.primary { background: var(--yt-text); color: var(--yt-bg); }
.btn.primary:hover { opacity: .85; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

.body { margin-top: 10px; }
.kritiek { font-size: 15px; line-height: 22px; font-weight: 500; margin: 0 0 4px; }
.kritiek .time { margin-left: 4px; }
.section-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: .5px; color: var(--yt-text-2); margin: 14px 0 6px; }
ul.takeaways { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
ul.takeaways li { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; padding: 6px 8px; margin: 0 -8px; border-radius: 8px; align-items: start; }
ul.takeaways li:hover { background: var(--yt-card-hover); }
ul.takeaways li.speaking, .kritiek.speaking { background: var(--yt-accent-bg); box-shadow: inset 3px 0 0 var(--yt-accent); }
.kritiek.speaking { border-radius: 8px; padding: 4px 8px; margin-left: -8px; margin-right: -8px; }
.tts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
.tts .btn svg { width: 18px; height: 18px; fill: currentColor; }
.tts-play.active { background: var(--yt-accent-bg); color: var(--yt-accent); }
.tts-voice { flex: 1; min-width: 0; max-width: 100%; height: 32px; font: inherit; font-size: 13px; color: var(--yt-text); background: var(--yt-bg); border: 1px solid var(--yt-border); border-radius: 16px; padding: 0 10px; cursor: pointer; }
.tts-voice:focus-visible { outline: 2px solid var(--yt-accent); outline-offset: 1px; }
.tts-note { font-size: 12px; color: var(--yt-text-2); }
.speak-btn { width: 26px; height: 26px; border: 0; border-radius: 50%; background: transparent; color: var(--yt-text-2); display: inline-flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .15s; }
.speak-btn svg { width: 16px; height: 16px; fill: currentColor; }
ul.takeaways li:hover .speak-btn, .speak-btn:focus-visible, .speak-btn.active { opacity: 1; }
.speak-btn:hover { background: var(--yt-card-hover); color: var(--yt-text); }
.speak-btn.active { color: var(--yt-accent); }
@media (hover: none) { .speak-btn { opacity: .7; } }
.time { font: 500 12px/18px "Roboto Mono", "Consolas", monospace; color: var(--yt-accent); background: var(--yt-accent-bg); border: 0; border-radius: 4px; padding: 1px 6px; margin-top: 1px; white-space: nowrap; }
.time:hover { text-decoration: underline; }
.zin { overflow-wrap: anywhere; }
.label { display: inline-block; font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: 4px; background: var(--yt-chip); color: var(--yt-text-2); margin-left: 6px; vertical-align: 1px; white-space: nowrap; }
.warn { display: inline-flex; vertical-align: -3px; margin-left: 4px; color: var(--yt-warn); }
.warn svg { width: 16px; height: 16px; fill: currentColor; }
.oordeel { margin-top: 12px; color: var(--yt-text-2); font-size: 13px; line-height: 18px; }
.oordeel b { color: var(--yt-text); font-weight: 500; }
.meta { margin-top: 10px; font-size: 12px; color: var(--yt-text-2); display: flex; flex-wrap: wrap; gap: 4px 10px; }
.notice { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: var(--yt-warn-bg); color: var(--yt-text); font-size: 13px; line-height: 18px; }
.empty { color: var(--yt-text-2); }

.loading { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.loading .step { color: var(--yt-text-2); font-size: 13px; display: flex; align-items: center; gap: 8px; }
.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--yt-border); border-top-color: var(--yt-accent); animation: spin .8s linear infinite; flex: none; }
.bar { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--yt-card) 0%, var(--yt-card-hover) 50%, var(--yt-card) 100%); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
.bar.w80 { width: 80%; } .bar.w60 { width: 60%; } .bar.w90 { width: 90%; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .spinner, .bar { animation: none; } }

.error-msg { margin-top: 10px; color: var(--yt-text); }
.error-msg::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--yt-error); margin-right: 8px; vertical-align: 1px; }
details { margin-top: 8px; font-size: 12px; color: var(--yt-text-2); }
details pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 6px 0 0; font: 12px/16px "Roboto Mono", "Consolas", monospace; max-height: 160px; overflow: auto; }
a.link { color: var(--yt-accent); text-decoration: none; cursor: pointer; }
a.link:hover { text-decoration: underline; }
.collapsed .body, .collapsed .loading, .collapsed .actions, .collapsed .error-msg, .collapsed details, .collapsed .notice { display: none; }
.collapsed .peek { display: block; }
.peek { display: none; margin-top: 6px; color: var(--yt-text-2); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gate { margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--yt-accent-bg); font-size: 13px; }
.gate span { flex: 1; }
`;

export const ICONS = {
  speaker:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>',
  // The Point logo: a play triangle followed by a full stop.
  logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.3v13.4a1.3 1.3 0 0 0 2 1.1l10.4-6.7a1.3 1.3 0 0 0 0-2.2L5 4.2a1.3 1.3 0 0 0-2 1.1z"/><circle cx="19.6" cy="17.6" r="2.4"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  chevronUp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
  chevronDown:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.3 7.3 0 0 0 0-1.88l2.03-1.58-1.92-3.32-2.39.96a7 7 0 0 0-1.63-.94L14.87 3.6h-3.84l-.36 2.58c-.59.24-1.13.56-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.3 7.3 0 0 0 0 1.88l-2.03 1.58 1.92 3.32 2.39-.96c.5.38 1.04.7 1.63.94l.36 2.58h3.84l.36-2.58c.59-.24 1.13-.56 1.63-.94l2.39.96 1.92-3.32-2.03-1.58zM12.95 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
};
