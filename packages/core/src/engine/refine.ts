// Refinement: rework the takeaways of an existing summary with one instruction of the
// user ("noem bij elk punt de tool", "geef bij punt 4 de stappen"). One model call; the
// answer is checked against the transcript like the summary itself.
import { renderedSize } from './chunking';
import { ENGINE_DEFAULTS } from './config';
import {
  buildRefineSystemPrompt,
  buildRefineUserMessage,
  REFINE_VIDEO_ADDENDUM,
  renderLines,
  renderTakeawaysForRefine,
  toLines,
  type TranscriptLine,
} from './prompt';
import { parseRefinementOutput, refinementJsonSchema } from './schema';
import { callValidated, providerFor, type SummarizeOptions } from './summarize';
import {
  EngineError,
  type ChatRequest,
  type Refinement,
  type Summary,
  type Transcript,
  type VideoMeta,
} from './types';
import { labelFor } from './refinements';
import { verifyRefinement } from './verify';

/** Longest instruction we send; a refinement is a short instruction, not a document. */
export const MAX_INSTRUCTION_LENGTH = 500;

export interface RefineInput {
  instructie: string;
  /** Button text for the tab; derived from the instruction when omitted. */
  label?: string;
}

/**
 * Refine a summary. With a transcript the model reads it; without one (summary made by
 * Gemini from the video) Gemini watches the video again.
 */
export async function refineSummary(
  meta: VideoMeta,
  transcript: Transcript | null,
  summary: Summary,
  input: RefineInput,
  opts: SummarizeOptions,
): Promise<Refinement> {
  const instructie = input.instructie.trim().slice(0, MAX_INSTRUCTION_LENGTH);
  if (!instructie) throw new EngineError('bad_request', 'De instructie is leeg.');
  if (!opts.apiKey) throw new EngineError('no_key', 'Er is geen API-sleutel ingesteld.');
  const provider = providerFor(opts);
  const schema = refinementJsonSchema();
  const takeawaysJson = renderTakeawaysForRefine(summary.takeaways);
  opts.onProgress?.('verfijnen');

  let lines: TranscriptLine[] | null = null;
  let req: ChatRequest;
  let call: (r: ChatRequest) => ReturnType<typeof provider.complete>;
  if (transcript) {
    const all = toLines(transcript.segmenten, ENGINE_DEFAULTS.lineSeconds);
    if (all.length === 0) throw new EngineError('no_transcript', 'Het transcript is leeg.');
    lines = fitLines(all, opts.chunkCharLimit ?? ENGINE_DEFAULTS.chunkCharLimit);
    req = {
      system: buildRefineSystemPrompt(opts.taal, schema),
      schema,
      user: buildRefineUserMessage(
        meta,
        transcript,
        renderLines(lines),
        takeawaysJson,
        instructie,
        {
          truncated: lines.length < all.length,
        },
      ),
    };
    call = (r) => provider.complete(r, opts);
  } else {
    if (!provider.completeWithVideo)
      throw new EngineError('no_transcript', 'Geen transcript beschikbaar om te verfijnen.');
    const url = `https://www.youtube.com/watch?v=${meta.videoId}`;
    req = {
      system: buildRefineSystemPrompt(opts.taal, schema) + REFINE_VIDEO_ADDENDUM,
      schema,
      user: buildRefineUserMessage(meta, null, null, takeawaysJson, instructie),
    };
    call = (r) => provider.completeWithVideo!(url, r, opts);
  }

  const { output, model } = await callValidated(
    call,
    req,
    'verfijnen',
    opts,
    parseRefinementOutput,
  );
  const takeaways = verifyRefinement(
    output,
    summary.takeaways,
    lines
      ? { lines, duurSeconden: meta.duurSeconden, extraTexts: [meta.titel, meta.kanaal] }
      : null,
  );
  if (takeaways.length === 0)
    throw new EngineError(
      'invalid_json',
      'De verfijning leverde geen bruikbare punten op. Probeer een andere instructie.',
    );
  const now = opts.now?.() ?? new Date();
  return {
    id: `v${now.getTime().toString(36)}`,
    label: (input.label?.trim() || labelFor(instructie)).slice(0, 40),
    instructie,
    aangemaaktOp: now.toISOString(),
    model,
    takeaways,
    toelichting: output.toelichting.trim(),
  };
}

/** The lines that fit in one call; a refinement does not split the transcript. */
function fitLines(lines: TranscriptLine[], limit: number): TranscriptLine[] {
  if (renderedSize(lines) <= limit) return lines;
  let lo = 1;
  let hi = lines.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (renderedSize(lines.slice(0, mid)) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return lines.slice(0, lo);
}
