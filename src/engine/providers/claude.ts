import { ENGINE_DEFAULTS } from '../config';
import {
  EngineError,
  type ChatRequest,
  type ProviderOptions,
  type RawModelOutput,
  type SummaryProvider,
} from '../types';
import { errorMessageFrom, requestJson } from './http';

const API = 'https://api.anthropic.com/v1';

/** Models that accept output_config.effort. */
function supportsEffort(model: string): boolean {
  return /claude-(opus-(4-[5-9]|5)|sonnet-(4-6|5)|fable|mythos)/.test(model);
}

/** Models that accept the server-side refusal fallback ("fallbacks": "default"). */
function supportsFallbacks(model: string): boolean {
  return /claude-(opus-5|sonnet-5-5|fable-5-1|mythos-5-1)/.test(model);
}

function headers(apiKey: string, model?: string): Record<string, string> {
  const h: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // Required for calls from a browser context (the extension service worker).
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (model && supportsFallbacks(model)) h['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  return h;
}

function describeError(status: number, body: unknown, text: string): EngineError {
  const message = errorMessageFrom(body, text);
  const type = (body as { error?: { type?: string } } | null)?.error?.type;
  if (status === 401 || type === 'authentication_error') {
    return new EngineError('auth', 'De Claude-API-sleutel is ongeldig.', {
      status,
      details: message,
    });
  }
  if (status === 403 || type === 'permission_error') {
    return new EngineError('auth', 'Deze Claude-API-sleutel heeft geen toegang tot dit model.', {
      status,
      details: message,
    });
  }
  if (status === 404 || type === 'not_found_error') {
    return new EngineError('model_not_found', 'Het ingestelde Claude-model bestaat niet.', {
      status,
      details: message,
    });
  }
  if (status === 429 || type === 'rate_limit_error') {
    return new EngineError(
      'rate_limit',
      'Claude is tijdelijk overbelast of de limiet is bereikt.',
      { status, details: message },
    );
  }
  if (status === 402 || /credit balance/i.test(message)) {
    return new EngineError('quota', 'Het tegoed van de Claude-account is op.', {
      status,
      details: message,
    });
  }
  if (status === 400 || status === 413) {
    return new EngineError('bad_request', 'Claude weigerde het verzoek.', {
      status,
      details: message,
    });
  }
  return new EngineError('server', 'De Claude-API gaf een serverfout.', {
    status,
    details: message,
  });
}

interface ClaudeResponse {
  model?: string;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function send(
  req: ChatRequest,
  opts: ProviderOptions,
  withFormat: boolean,
): Promise<RawModelOutput> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: ENGINE_DEFAULTS.maxOutputTokens,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  };
  const outputConfig: Record<string, unknown> = {};
  if (supportsEffort(opts.model)) outputConfig.effort = ENGINE_DEFAULTS.claudeEffort;
  if (withFormat) outputConfig.format = { type: 'json_schema', schema: req.schema };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;
  if (supportsFallbacks(opts.model)) body.fallbacks = 'default';

  const res = await requestJson(
    `${API}/messages`,
    { headers: headers(opts.apiKey, opts.model), body },
    opts,
    describeError,
  );
  const data = res.body as ClaudeResponse;
  if (data.stop_reason === 'refusal') {
    throw new EngineError('refusal', 'Claude weigerde deze video samen te vatten.');
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  if (data.stop_reason === 'max_tokens') {
    throw new EngineError('truncated', 'Het antwoord van Claude werd afgekapt.', {
      details: text.slice(-300),
    });
  }
  return {
    text,
    model: data.model ?? opts.model,
    usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
  };
}

export const claudeProvider: SummaryProvider = {
  id: 'claude',

  async complete(req, opts) {
    try {
      return await send(req, opts, true);
    } catch (e) {
      // Older models without structured outputs: retry with the schema in the prompt only.
      if (
        e instanceof EngineError &&
        e.code === 'bad_request' &&
        /output_config|format|schema/i.test(e.details ?? '')
      ) {
        return send(req, opts, false);
      }
      throw e;
    }
  },

  async testConnection(opts) {
    await requestJson(
      `${API}/models/${encodeURIComponent(opts.model)}`,
      { method: 'GET', headers: headers(opts.apiKey) },
      opts,
      describeError,
    );
  },
};
