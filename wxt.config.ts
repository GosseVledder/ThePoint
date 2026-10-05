import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  manifest: {
    name: 'YouTube AI-samenvatter',
    description: 'Toont een AI-samenvatting van een YouTube-video voordat je hem bekijkt.',
    permissions: ['storage', 'unlimitedStorage', 'declarativeNetRequestWithHostAccess'],
    // Toolbar button opens the options page (handled in the background).
    action: { default_title: 'YouTube AI-samenvatter – instellingen' },
    host_permissions: [
      'https://www.youtube.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  },
  webExt: {
    binaries: {
      edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
  },
});
