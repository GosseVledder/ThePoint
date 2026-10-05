import { z } from 'zod';

const videoType = z.enum([
  'nieuwsoverzicht',
  'uitleg',
  'tutorial',
  'interview',
  'opinie',
  'review',
  'overig',
]);
const zekerheid = z.enum(['feit', 'bewering', 'mening', 'gerucht']);
const dichtheid = z.enum(['hoog', 'gemiddeld', 'laag']);
const kwaliteit = z.enum(['goed', 'matig', 'slecht']);

/** What the model must return (docs/PROMPT-TAKEAWAYS.md, chapter 3). */
export const modelOutputSchema = z.object({
  videoType: videoType,
  kritiekPunt: z.object({
    zin: z.string().describe('Eén zin, maximaal 35 woorden.'),
    tijd: z
      .string()
      .nullable()
      .describe('mm:ss of u:mm:ss, of null als het punt niet aan één moment gebonden is.'),
  }),
  takeaways: z.array(
    z.object({
      zin: z.string().describe('Eén zin, bij voorkeur hooguit 25 woorden.'),
      tijd: z.string().describe('Tijdmarkering uit het transcript, mm:ss of u:mm:ss.'),
      zekerheid: zekerheid,
      afgeleid: z.boolean(),
      citaat: z.string().describe('Letterlijk fragment uit het transcript, max. 20 woorden.'),
    }),
  ),
  inhoudsoordeel: z.object({
    dichtheid: dichtheid,
    toelichting: z.string(),
  }),
  isInterview: z.boolean(),
  transcriptKwaliteit: kwaliteit,
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** Full stored summary; used to validate cache entries. */
export const summarySchema = z.object({
  videoId: z.string(),
  titel: z.string(),
  taal: z.string(),
  bron: z.enum(['transcript', 'gemini_video']),
  provider: z.enum(['claude', 'gemini']),
  model: z.string(),
  aangemaaktOp: z.string(),
  videoType: videoType,
  kritiekPunt: z.object({
    zin: z.string(),
    tijd: z.string().nullable(),
    seconden: z.number().nullable(),
  }),
  takeaways: z.array(
    z.object({
      zin: z.string(),
      tijd: z.string(),
      seconden: z.number(),
      zekerheid: zekerheid,
      afgeleid: z.boolean(),
      citaat: z.string(),
      onbevestigd: z.boolean(),
    }),
  ),
  inhoudsoordeel: z.object({ dichtheid: dichtheid, toelichting: z.string() }),
  isInterview: z.boolean(),
  transcriptKwaliteit: kwaliteit,
});

type JsonObject = Record<string, unknown>;

/**
 * JSON Schema for the model output, in the subset both providers accept:
 * every object closed with additionalProperties:false and all properties required.
 */
export function modelOutputJsonSchema(): JsonObject {
  const schema = z.toJSONSchema(modelOutputSchema, { target: 'draft-7' }) as JsonObject;
  delete schema.$schema;
  closeObjects(schema);
  return schema;
}

function closeObjects(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(closeObjects);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as JsonObject;
  if (Array.isArray(obj.type)) {
    obj.anyOf = (obj.type as string[]).map((t) => ({ type: t }));
    delete obj.type;
  }
  if (obj.type === 'object' && obj.properties && typeof obj.properties === 'object') {
    obj.additionalProperties = false;
    obj.required = Object.keys(obj.properties as JsonObject);
  }
  Object.values(obj).forEach(closeObjects);
}

/** Extract and parse JSON from a model answer, tolerating code fences and stray text. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new SyntaxError('Geen JSON-object gevonden in het antwoord.');
}

export type ParseResult = { ok: true; value: ModelOutput } | { ok: false; error: string };

export function parseModelOutput(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Ongeldige JSON: ${(e as Error).message}` };
  }
  const result = modelOutputSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, value: result.data };
}
