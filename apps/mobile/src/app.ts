// What every screen gets: the stores, the speaker and navigation.
import type { Messages } from '@the-point/core/i18n/messages';
import type { Speaker } from './speech';
import type { KeyStore, SettingsStore, SummaryCache } from './storage/stores';

export interface App {
  settings: SettingsStore;
  keys: KeyStore;
  cache: SummaryCache;
  speaker: Speaker;
  /** Navigate to a hash route ("#/", "#/v/<id>", "#/instellingen"). */
  go(hash: string): void;
  /** One screen back (header arrow and Android back); leaves the app on home. */
  back(): void;
  toast(message: string): void;
  /** Interface texts in the chosen interface language. */
  t: Messages;
  /** Switch the interface language and rebuild the current screen. */
  setLanguage(lang: string): void;
  /** Title-bar toggle: show the YouTube player above a summary. Off at app start. */
  playerOn: boolean;
  setPlayerOn(on: boolean): void;
}

export interface Screen {
  title: string;
  el: HTMLElement;
  /** Re-render after a change outside the screen (speech state, voices loaded). */
  refresh?(): void;
  /** Back button: true when the screen handled it itself (e.g. closed a dialog). */
  back?(): boolean;
  /** Present on screens with a player: the title-bar toggle shows and drives it. */
  setPlayer?(on: boolean): void;
  dispose?(): void;
}

export type Route =
  | { name: 'home' }
  | { name: 'summary'; videoId: string; start: number | null }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/v\/([A-Za-z0-9_-]{11})(?:\/(\d+))?$/);
  if (m?.[1]) return { name: 'summary', videoId: m[1], start: m[2] ? Number(m[2]) : null };
  if (hash === '#/instellingen') return { name: 'settings' };
  return { name: 'home' };
}

export function summaryHash(videoId: string, start?: number | null): string {
  return `#/v/${videoId}${start ? `/${Math.floor(start)}` : ''}`;
}

/**
 * Our own screen history. The WebView's history is not usable: the embedded YouTube
 * player adds entries of its own, so "back" would only navigate inside the player.
 */
export class NavStack {
  private stack: string[] = ['#/'];

  get current(): string {
    return this.stack[this.stack.length - 1] ?? '#/';
  }

  /** Home clears the stack; a screen that is already open again cuts back to it. */
  push(hash: string): void {
    if (parseRoute(hash).name === 'home') {
      this.stack = ['#/'];
      return;
    }
    const i = this.stack.indexOf(hash);
    if (i >= 0) this.stack.length = i + 1;
    else this.stack.push(hash);
  }

  /** A share opens the video with home underneath. */
  reset(hash: string): void {
    this.stack = ['#/'];
    this.push(hash);
  }

  /** False on home: then the app should close. */
  back(): boolean {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    return true;
  }
}

export const isDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
