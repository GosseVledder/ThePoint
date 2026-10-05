import { chunkLines, mapLimit, renderedSize } from './chunking';
import { ENGINE_DEFAULTS } from './config';
import {
  buildMergeMessage,
  buildRepairMessage,
  buildSystemPrompt,
  buildUserMessage,
  buildVideoUserMessage,
  renderLines,
  toLines,
  VIDEO_ADDENDUM,
} from './prompt';
import { claudeProvider } from './providers/claude';
import { geminiProvider } from './providers/gemini';
import { modelOutputJsonSchema, parseModelOutput, type ModelOutput } from './schema';
import {
  EngineError,
  type CallLog,
  type ChatRequest,
  type ProviderId,
  type ProviderOptions,
  type RawModelOutput,
  type Summary,
  type SummaryProvider,
  type Transcript,
  type VideoMeta,
} from './types';
import { verifyAgainstTranscript, verifyVideoAnswer, type VerifyStats } from './verify';

export const PROVIDERS: Record<ProviderId, SummaryProvider> = {
  claude: claudeProvider,
  gemini: geminiProvider,
};

export type Progress = 'samenvatten' | 'deel' | 'samenvoegen' | 'herstel' | 'video';

export interface SummarizeOptions extends ProviderOptions {
  provider: ProviderId;
  /** Output language code, e.g. "nl". */
  taal: string;
  chunkCharLimit?: number;
  onProgress?: (stap: Progress, detail?: { deel?: number; delen?: number }) => void;
  onCall?: (log: CallLog) => void;
  /** Injected for tests. */
  now?: () => Date;
  providers?: Partial<Record<ProviderId, SummaryProvider>>;
}

export interface SummarizeResult {
  summary: Summary;
  stats?: VerifyStats;
}

function providerFor(opts: SummarizeOptions): SummaryProvider {
  const p = opts.providers?.[opts.provider] ?? PROVIDERS[opts.provider];
  if (!p) throw new EngineError('bad_request', `Onbekende provider: ${opts.provider}`);
  return p;
}

/** Call the model, validate, and make one repair attempt on invalid output. */
async function callValidated(
  call: (req: ChatRequest) => Promise<RawModelOutput>,
  req: ChatRequest,
  stap: CallLog['stap'],
  opts: SummarizeOptions,
): Promise<{ output: ModelOutput; model: string }> {
  const first = await logged(() => call(req), req, stap, opts);
  const parsed = parseModelOutput(first.text);
  if (parsed.ok) return { output: parsed.value, model: first.model ?? opts.model };

  opts.onProgress?.('herstel');
  const repairReq: ChatRequest = {
    ...req,
    user: buildRepairMessage(req.user, first.text, parsed.error),
  };
  const second = await logged(() => call(repairReq), repairReq, 'herstel', opts);
  const reparsed = parseModelOutput(second.text);
  if (reparsed.ok) return { output: reparsed.value, model: second.model ?? opts.model };
  throw new EngineError(
    'invalid_json',
    'Het AI-model gaf geen bruikbaar antwoord, ook niet na een herstelpoging.',
    {
      details: reparsed.error,
    },
  );
}

async function logged(
  fn: () => Promise<RawModelOutput>,
  req: ChatRequest,
  stap: CallLog['stap'],
  opts: SummarizeOptions,
): Promise<RawModelOutput> {
  const started = Date.now();
  const base = {
    provider: opts.provider,
    model: opts.model,
    stap,
    invoerTekens: req.system.length + req.user.length,
  };
  try {
    const out = await fn();
    opts.onCall?.({
      ...base,
      model: out.model ?? opts.model,
      duurMs: Date.now() - started,
      usage: out.usage,
    });
    return out;
  } catch (e) {
    opts.onCall?.({
      ...base,
      duurMs: Date.now() - started,
      fout: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

function assemble(
  meta: VideoMeta,
  output: ModelOutput,
  verified: Pick<Summary, 'kritiekPunt' | 'takeaways'>,
  bron: Summary['bron'],
  model: string,
  opts: SummarizeOptions,
): Summary {
  return {
    videoId: meta.videoId,
    titel: meta.titel,
    taal: opts.taal,
    bron,
    provider: opts.provider,
    model,
    aangemaaktOp: (opts.now?.() ?? new Date()).toISOString(),
    videoType: output.videoType,
    kritiekPunt: verified.kritiekPunt,
    takeaways: verified.takeaways,
    inhoudsoordeel: output.inhoudsoordeel,
    isInterview: output.isInterview,
    transcriptKwaliteit: output.transcriptKwaliteit,
  };
}

/** Summarize a video from its transcript (the default route). */
export async function summarizeTranscript(
  meta: VideoMeta,
  transcript: Transcript,
  opts: SummarizeOptions,
): Promise<SummarizeResult> {
  if (!opts.apiKey) throw new EngineError('no_key', 'Er is geen API-sleutel ingesteld.');
  const provider = providerFor(opts);
  const schema = modelOutputJsonSchema();
  const system = buildSystemPrompt(opts.taal, schema);
  const lines = toLines(transcript.segmenten, ENGINE_DEFAULTS.lineSeconds);
  if (lines.length === 0) throw new EngineError('no_transcript', 'Het transcript is leeg.');
  const call = (req: ChatRequest) => provider.complete(req, opts);
  const limit = opts.chunkCharLimit ?? ENGINE_DEFAULTS.chunkCharLimit;

  let output: ModelOutput;
  let model: string;
  if (renderedSize(lines) <= limit) {
    opts.onProgress?.('samenvatten');
    const req = { system, schema, user: buildUserMessage(meta, transcript, renderLines(lines)) };
    ({ output, model } = await callValidated(call, req, 'samenvatten', opts));
  } else {
    const chunks = chunkLines(lines, limit);
    let done = 0;
    opts.onProgress?.('deel', { deel: 0, delen: chunks.length });
    const parts = await mapLimit(chunks, ENGINE_DEFAULTS.chunkConcurrency, async (chunk, i) => {
      const req = {
        system,
        schema,
        user: buildUserMessage(meta, transcript, renderLines(chunk), {
          index: i + 1,
          total: chunks.length,
        }),
      };
      const res = await callValidated(call, req, 'deel', opts);
      opts.onProgress?.('deel', { deel: ++done, delen: chunks.length });
      return res.output;
    });
    opts.onProgress?.('samenvoegen');
    const mergeReq = {
      system,
      schema,
      user: buildMergeMessage(
        meta,
        parts.map((p) => JSON.stringify(p)),
      ),
    };
    ({ output, model } = await callValidated(call, mergeReq, 'samenvoegen', opts));
  }

  const { result, stats } = verifyAgainstTranscript(output, {
    lines,
    duurSeconden: meta.duurSeconden,
    extraTexts: [meta.titel, meta.kanaal],
  });
  return { summary: assemble(meta, output, result, 'transcript', model, opts), stats };
}

/** Fallback without transcript: Gemini watches the public video itself. */
export async function summarizeVideoUrl(
  meta: VideoMeta,
  opts: SummarizeOptions,
): Promise<SummarizeResult> {
  if (!opts.apiKey) throw new EngineError('no_key', 'Er is geen Gemini-API-sleutel ingesteld.');
  const provider = providerFor(opts);
  if (!provider.completeWithVideo) {
    throw new EngineError('bad_request', 'Deze provider kan geen video analyseren.');
  }
  const schema = modelOutputJsonSchema();
  const system = buildSystemPrompt(opts.taal, schema) + VIDEO_ADDENDUM;
  const url = `https://www.youtube.com/watch?v=${meta.videoId}`;
  opts.onProgress?.('video');
  const req = { system, schema, user: buildVideoUserMessage(meta) };
  const { output, model } = await callValidated(
    (r) => provider.completeWithVideo!(url, r, opts),
    req,
    'video',
    opts,
  );
  const verified = verifyVideoAnswer(output, meta.duurSeconden);
  return { summary: assemble(meta, output, verified, 'gemini_video', model, opts) };
}
