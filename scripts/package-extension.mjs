// Build the extension and put a ready-to-load copy in `extension/` for download from GitHub:
// the unpacked folder `extension/ThePoint/` and `extension/ThePoint-extension-<version>.zip`.
// Usage: npm run package:extension
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'apps/extension/.output');
const target = join(root, 'extension');
const { version } = JSON.parse(readFileSync(join(root, 'apps/extension/package.json'), 'utf8'));

// `wxt zip` builds first, then zips .output/chrome-mv3.
execSync('npm run zip', { cwd: root, stdio: 'inherit' });

const builtZip = readdirSync(output).find((f) => f.endsWith(`-${version}-chrome.zip`));
if (!builtZip) throw new Error(`Geen zip voor versie ${version} in ${output}`);

mkdirSync(target, { recursive: true });
for (const name of readdirSync(target))
  if (name === 'ThePoint' || /^ThePoint-extension-.*\.zip$/.test(name))
    rmSync(join(target, name), { recursive: true });

cpSync(join(output, 'chrome-mv3'), join(target, 'ThePoint'), { recursive: true });
const zipName = `ThePoint-extension-${version}.zip`;
copyFileSync(join(output, builtZip), join(target, zipName));

const zip = readFileSync(join(target, zipName));
const sha256 = createHash('sha256').update(zip).digest('hex');
console.log(`\nextension/ThePoint/ en extension/${zipName}`);
console.log(`Grootte: ${Math.round(zip.length / 1024)} kB, SHA-256: ${sha256}`);
console.log('Werk in de README de versie, grootte en SHA-256 bij.');
