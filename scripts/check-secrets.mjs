// Fails when a tracked or staged file contains something that looks like an API key.
// Runs as `npm run secrets`; `npm run secrets -- --install` makes it the git pre-commit hook.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PATTERNS = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const FORBIDDEN_FILES = /(^|\/)\.env(\.[^/]*)?$/;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

if (process.argv.includes('--install')) {
  const hook = git('rev-parse', '--git-path', 'hooks/pre-commit').trim();
  writeFileSync(hook, ['#!/bin/sh', 'exec npm run --silent secrets', ''].join('\n'), {
    mode: 0o755,
  });
  console.log(`Pre-commit-hook geïnstalleerd: ${hook}`);
  process.exit(0);
}
const files = new Set(
  [...git('ls-files').split('\n'), ...git('diff', '--cached', '--name-only').split('\n')].filter(
    Boolean,
  ),
);

const problems = [];
for (const file of files) {
  if (FORBIDDEN_FILES.test(file)) problems.push(`${file}: .env-bestand hoort niet in git`);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }
  for (const [name, re] of PATTERNS) if (re.test(text)) problems.push(`${file}: ${name}`);
}

if (problems.length) {
  console.error(`Mogelijke geheimen gevonden:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Geen geheimen gevonden in ${files.size} bestanden.`);
