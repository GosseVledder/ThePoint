import type { TranscriptLine } from './prompt';

/**
 * Split transcript lines into chunks whose rendered size ("[mm:ss] text\n") stays
 * within `limit` characters. Lines are never split, so every chunk keeps real markers.
 */
export function chunkLines(lines: TranscriptLine[], limit: number): TranscriptLine[][] {
  if (limit <= 0) throw new RangeError('limit must be positive');
  const chunks: TranscriptLine[][] = [];
  let current: TranscriptLine[] = [];
  let size = 0;
  for (const line of lines) {
    const lineSize = line.marker.length + line.tekst.length + 4;
    if (current.length > 0 && size + lineSize > limit) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += lineSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function renderedSize(lines: TranscriptLine[]): number {
  return lines.reduce((n, l) => n + l.marker.length + l.tekst.length + 4, 0);
}

/** Run async tasks with a concurrency limit, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}
