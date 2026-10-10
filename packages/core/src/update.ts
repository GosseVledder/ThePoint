// Update check against the latest GitHub release of the public repository. Each release
// carries the APK and the extension zip; their versions are in the file names, so the app
// and the extension can be released at different versions. `npm run publish:public`
// creates the release (scripts/publish-public.mjs).
export const RELEASE_REPO = 'GosseVledder/ThePoint';
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${RELEASE_REPO}/releases`;

export type UpdateTarget = 'app' | 'extension';

export interface ReleaseAsset {
  name: string;
  version: string;
  /** Download link of the file (redirects to GitHub's file host). */
  url: string;
  size: number;
  /** Lowercase hex, from the asset's `digest` ("sha256:…"); null when GitHub has none. */
  sha256: string | null;
}

export type UpdateCheck =
  /** Installed version is the newest (or newer than the release). */
  | { status: 'current'; latest: string }
  | { status: 'available'; asset: ReleaseAsset; page: string }
  /** No release yet, or the release has no file for this target. */
  | { status: 'none' };

/** File names as written by scripts/package-extension.mjs and the Gradle build. */
export const ASSET_NAMES: Record<UpdateTarget, RegExp> = {
  app: /^ThePoint-(\d+(?:\.\d+)*)\.apk$/,
  extension: /^ThePoint-extension-(\d+(?:\.\d+)*)\.zip$/,
};

/** Numeric comparison of dotted versions: <0 when a is older, >0 when newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

/** The newest file for `target` in a release from the GitHub API, if any. */
export function findAsset(release: unknown, target: UpdateTarget): ReleaseAsset | null {
  const assets = (release as { assets?: unknown } | null)?.assets;
  if (!Array.isArray(assets)) return null;
  let best: ReleaseAsset | null = null;
  for (const a of assets as Record<string, unknown>[]) {
    const name = typeof a.name === 'string' ? a.name : '';
    const version = ASSET_NAMES[target].exec(name)?.[1];
    const url = a.browser_download_url;
    if (!version || typeof url !== 'string') continue;
    const digest = typeof a.digest === 'string' ? /^sha256:([0-9a-f]{64})$/i.exec(a.digest) : null;
    const asset: ReleaseAsset = {
      name,
      version,
      url,
      size: typeof a.size === 'number' ? a.size : 0,
      sha256: digest?.[1]?.toLowerCase() ?? null,
    };
    if (!best || compareVersions(asset.version, best.version) > 0) best = asset;
  }
  return best;
}

export interface CheckOptions {
  target: UpdateTarget;
  /** Installed version, e.g. "0.4.0". */
  current: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Ask GitHub for the latest release and compare it with the installed version. */
export async function checkForUpdate(opts: CheckOptions): Promise<UpdateCheck> {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const res = await doFetch(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (res.status === 404) return { status: 'none' };
  if (!res.ok) throw new Error(`GitHub antwoordde met status ${res.status}.`);
  const release = (await res.json()) as { html_url?: unknown };
  const asset = findAsset(release, opts.target);
  if (!asset) return { status: 'none' };
  if (compareVersions(asset.version, opts.current) <= 0)
    return { status: 'current', latest: asset.version };
  const page = typeof release.html_url === 'string' ? release.html_url : RELEASES_PAGE;
  return { status: 'available', asset, page };
}
