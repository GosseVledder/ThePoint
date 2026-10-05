// Real model call on a fixture or a live video, outside the extension.
// Usage:
//   npm run try -- <fixture-or-videoId> [--provider claude|gemini] [--model <id>] [--taal nl] [--video] [--save]
// Keys come from .env.local (not committed) or the environment:
//   ANTHROPIC_API_KEY=...   GEMINI_API_KEY=...
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DEFAULT_MODELS } from '../src/engine/config';
import { summarizeTranscript, summarizeVideoUrl } from '../src/engine/summarize';
import type { ProviderId, Transcript, VideoMeta } from '../src/engine/types';
import { getTranscriptById } from '../src/youtube/transcript';

const root = join(import.meta.dirname, '..');
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const target = args.find(
  (a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'),
);
if (!target) {
  console.error(
    'Gebruik: npm run try -- <fixture-of-videoId> [--provider gemini] [--model ...] [--video] [--save]',
  );
  process.exit(1);
}
const provider = (flag('provider') ??
  (process.env.ANTHROPIC_API_KEY ? 'claude' : 'gemini')) as ProviderId;
const apiKey = provider === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    `Geen sleutel voor ${provider}. Zet ${provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} in .env.local.`,
  );
  process.exit(1);
}
const model = flag('model') ?? DEFAULT_MODELS[provider];
const taal = flag('taal') ?? 'nl';

let meta: VideoMeta;
let transcript: Transcript | null;
const fixturePath = existsSync(target)
  ? target
  : join(root, 'tests', 'fixtures', `${basename(target, '.json')}.json`);
if (existsSync(fixturePath)) {
  const fx = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    meta: VideoMeta;
    transcript: Transcript | null;
  };
  meta = fx.meta;
  transcript = fx.transcript;
} else {
  const res = await getTranscriptById(target);
  meta = res.info.meta;
  transcript = res.transcript;
}

const started = Date.now();
const common = {
  provider,
  apiKey,
  model,
  taal,
  onProgress: (stap: string, d?: { deel?: number; delen?: number }) =>
    console.error(`… ${stap}${d?.delen ? ` ${d.deel}/${d.delen}` : ''}`),
  onCall: (log: unknown) => console.error('  call', JSON.stringify(log)),
};
const result =
  args.includes('--video') || !transcript
    ? await summarizeVideoUrl(meta, common)
    : await summarizeTranscript(meta, transcript, common);

console.log(JSON.stringify(result.summary, null, 2));
if (result.stats) console.error('controles', JSON.stringify(result.stats));
console.error(`klaar in ${((Date.now() - started) / 1000).toFixed(1)} s`);
if (args.includes('--save')) {
  const out = join(root, 'tests', 'fixtures', `summary-${meta.videoId}-${provider}.json`);
  writeFileSync(out, JSON.stringify(result.summary, null, 2));
  console.error(`opgeslagen: ${out}`);
}
