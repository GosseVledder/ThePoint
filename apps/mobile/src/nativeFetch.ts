// fetch() on top of Capacitor's native HTTP: no CORS, and headers such as Origin can be
// set. The extension needs a declarativeNetRequest rule for the same Origin header.
import { CapacitorHttp, type HttpHeaders } from '@capacitor/core';

const YOUTUBE = /^https:\/\/www\.youtube\.com\/(youtubei\/v1\/player|api\/timedtext)/;

export const nativeFetch: typeof fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: HttpHeaders = {};
  new Headers(init.headers).forEach((value, key) => (headers[key] = value));
  // YouTube answers 403 to player requests without its own Origin.
  if (YOUTUBE.test(url)) headers.origin = 'https://www.youtube.com';

  let data: unknown = init.body ?? undefined;
  if (typeof data === 'string' && /json/i.test(headers['content-type'] ?? '')) {
    data = JSON.parse(data);
  }
  const request = CapacitorHttp.request({
    url,
    method: init.method ?? 'GET',
    headers,
    data,
    responseType: 'text',
  });
  const res = await abortable(request, init.signal);
  const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  // Response() refuses a body for these statuses.
  const empty = res.status === 204 || res.status === 205 || res.status === 304;
  return new Response(empty ? null : body, { status: res.status, headers: res.headers });
};

/** The native request cannot be cancelled; the caller just stops waiting. */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
