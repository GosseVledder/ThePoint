// Bridge to ShareIntentPlugin.java: text shared to the app via "Delen".
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ShareEvent {
  text: string;
  subject: string;
}

interface ShareIntentPlugin {
  addListener(event: 'shared', cb: (e: ShareEvent) => void): Promise<PluginListenerHandle>;
}

const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent');

/** A share that started the app is delivered as soon as the listener is added. */
export function onShare(cb: (e: ShareEvent) => void): void {
  void ShareIntent.addListener('shared', cb).catch(() => {
    // Not available outside Android (vite dev server in a browser).
  });
}
