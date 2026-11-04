// Build flavor. `npm run package:store` builds with `--mode store`: the version for the
// Chrome Web Store and Edge Add-ons, which update the extension themselves. That build
// has no GitHub update check and no "download the zip and reload" steps.
export const STORE_BUILD = import.meta.env.MODE === 'store';
