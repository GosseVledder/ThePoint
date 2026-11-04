// A summary as plain text or Markdown: for Copy (free) and, later, the export menu (Pro).
// Pure: no DOM, so the tests run without a browser.
import type { Summary, Takeaway } from '../engine/types';
import type { Messages } from '../i18n/messages';

export type TextFormat = 'text' | 'markdown';

export const videoUrl = (videoId: string, seconds?: number | null): string =>
  `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${Math.floor(seconds)}s` : ''}`;

/** Escapes the characters that would turn plain words into Markdown formatting. */
const escapeMd = (s: string) => s.replace(/([\\`*_[\]<>#|])/g, '\\$1');

function labels(item: Takeaway, v: Messages['view']): string[] {
  const out: string[] = [];
  if (item.zekerheid !== 'feit') out.push(v.zekerheid[item.zekerheid]);
  if (item.afgeleid) out.push(v.derived);
  return out;
}

export function summaryToText(s: Summary, t: Messages, opts: { format?: TextFormat } = {}): string {
  const md = opts.format === 'markdown';
  const v = t.view;
  const text = (x: string) => (md ? escapeMd(x) : x);
  const time = (tijd: string, seconden: number) =>
    md ? `[${tijd}](${videoUrl(s.videoId, seconden)})` : tijd;

  const lines: string[] = [];
  lines.push(md ? `# ${text(s.titel)}` : s.titel);
  lines.push(md ? `<${videoUrl(s.videoId)}>` : videoUrl(s.videoId));
  lines.push('');

  const k = s.kritiekPunt;
  const kTime = k.tijd !== null && k.seconden !== null ? ` (${time(k.tijd, k.seconden)})` : '';
  lines.push(`${md ? `**${v.keyPoint}:**` : `${v.keyPoint}:`} ${text(k.zin)}${kTime}`);

  if (s.takeaways.length > 0) {
    lines.push('');
    lines.push(md ? `## ${v.takeaways(s.takeaways.length)}` : v.takeaways(s.takeaways.length));
    for (const item of s.takeaways) {
      const extra = labels(item, v);
      const tail = extra.length ? ` (${extra.join(', ')})` : '';
      const stamp = md ? time(item.tijd, item.seconden) : `[${item.tijd}]`;
      lines.push(`- ${stamp} ${text(item.zin)}${tail}`);
    }
  }

  lines.push('');
  lines.push(`${v.density[s.inhoudsoordeel.dichtheid]} · ${text(s.inhoudsoordeel.toelichting)}`);
  return lines.join('\n');
}
