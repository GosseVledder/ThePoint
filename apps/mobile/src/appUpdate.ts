// Updates from the GitHub release: the check is shared with the extension (core/update),
// downloading and installing the APK happens in AppUpdatePlugin.java.
import { App as CapApp } from '@capacitor/app';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { checkForUpdate, type ReleaseAsset, type UpdateCheck } from '@the-point/core/update';
import { nativeFetch } from './nativeFetch';

interface AppUpdatePlugin {
  downloadAndInstall(o: { url: string; fileName: string; sha256: string | null }): Promise<void>;
  addListener(
    event: 'progress',
    fn: (e: { percent: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

/** The installed versionName; null outside Android (vite dev server in a browser). */
export async function installedVersion(): Promise<string | null> {
  try {
    return (await CapApp.getInfo()).version;
  } catch {
    return null;
  }
}

export function checkAppUpdate(current: string): Promise<UpdateCheck> {
  return checkForUpdate({ target: 'app', current, fetch: nativeFetch });
}

/** Why an install did not start: the SHA-256 did not match, or anything else. */
export class UpdateError extends Error {
  constructor(
    readonly code: 'checksum' | 'other',
    message: string,
  ) {
    super(message);
  }
}

/** Download the APK (progress in percent) and open the Android installer. */
export async function downloadAndInstall(
  asset: ReleaseAsset,
  onProgress: (percent: number) => void,
): Promise<void> {
  const listener = await AppUpdate.addListener('progress', (e) => onProgress(e.percent));
  try {
    await AppUpdate.downloadAndInstall({
      url: asset.url,
      fileName: asset.name,
      sha256: asset.sha256,
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    throw new UpdateError(err.code === 'checksum' ? 'checksum' : 'other', err.message ?? String(e));
  } finally {
    void listener.remove();
  }
}
