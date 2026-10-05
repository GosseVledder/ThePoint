import { ENGINE_DEFAULTS } from '../config';
import { EngineError, type ProviderOptions } from '../types';

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface HttpResult {
  status: number;
  body: unknown;
  text: string;
}

/**
 * POST/GET JSON with a timeout, abort support and one retry after a rate limit or
 * temporary overload (429, 503, 529), honouring Retry-After up to a cap.
 */
export async function requestJson(
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: unknown },
  opts: ProviderOptions,
  describeError: (status: number, body: unknown, text: string) => EngineError,
): Promise<HttpResult> {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = opts.sleep ?? defaultSleep;
  const timeoutMs = opts.timeoutMs ?? ENGINE_DEFAULTS.timeoutMs;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new DOMException('timeout', 'TimeoutError')),
      timeoutMs,
    );
    let res: Response;
    try {
      res = await doFetch(url, {
        method: init.method ?? 'POST',
        headers: init.headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch (e) {
      if (opts.signal?.aborted) throw new EngineError('aborted', 'Verzoek afgebroken.');
      if (controller.signal.aborted) {
        throw new EngineError(
          'timeout',
          `Geen antwoord binnen ${Math.round(timeoutMs / 1000)} seconden.`,
        );
      }
      throw new EngineError('network', 'Geen verbinding met de AI-dienst.', { details: String(e) });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }

    const text = await res.text();
    const body = parseJsonOrNull(text);
    if (res.ok) return { status: res.status, body, text };

    const retryable = res.status === 429 || res.status === 503 || res.status === 529;
    if (retryable && attempt === 0) {
      const wait = retryAfterMs(res.headers.get('retry-after'));
      if (wait <= ENGINE_DEFAULTS.maxRetryWaitMs) {
        await sleep(wait);
        continue;
      }
    }
    throw describeError(res.status, body, text);
  }
}

function retryAfterMs(header: string | null): number {
  if (!header) return 2_000;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 2_000;
}

export function errorMessageFrom(body: unknown, text: string): string {
  const b = body as { error?: { message?: string } } | null;
  return b?.error?.message ?? text.slice(0, 500);
}

function parseJsonOrNull(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
