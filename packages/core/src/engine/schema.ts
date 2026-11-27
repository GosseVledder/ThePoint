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
const moment = z.enum(['gebeurtenis', 'uitspraak', 'onderwerp']);
const dichtheid = z.enum(['hoog', 'gemiddeld', 'laag']);
const kwaliteit = z.enum(['goed', 'matig', 'slecht']);

const suggestion = z.object({
  label: z.string().describe('Knoptekst, 2 tot 4 woorden.'),
  instructie: z.string().describe('De volledige instructie, één zin.'),
});

/** What the model must return (docs/PROMPT-TAKEAWAYS.md, chapter 3). */
export const modelOutputSchema = z.object({
  videoType: videoType,
  kritiekPunt: z.object({
    zin: z.string().describe('Eén zin, maximaal 35 woorden.'),
    tijd: z
      .string()
      .nullable()
      .describe('mm:ss of u:mm:ss, of null als het punt niet aan één moment gebonden is.'),
    moment: moment.optional(),
  }),
  takeaways: z.array(
    z.object({
      zin: z.string().describe('Eén zin, bij voorkeur hooguit 25 woorden.'),
      tijd: z.string().describe('Tijdmarkering uit het transcript, mm:ss of u:mm:ss.'),
      zekerheid: zekerheid,
      afgeleid: z.boolean(),
      citaat: z.string().describe('Letterlijk fragment uit het transcript, max. 20 woorden.'),
      moment: moment.optional(),
    }),
  ),
  inhoudsoordeel: z.object({
    dichtheid: dichtheid,
    toelichting: z.string(),
  }),
  isInterview: z.boolean(),
  transcriptKwaliteit: kwaliteit,
  // Optional when parsing (older answers, merge step); the JSON Schema still asks for it.
  verfijningen: z.array(suggestion).optional(),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** What the model returns for a refinement: the points reworked by one instruction. */
export const refinementOutputSchema = z.object({
  punten: z.array(
    z.object({
      nr: z
        .number()
        .int()
        .nullable()
        .describe('Nummer van het oorspronkelijke punt, of null bij een nieuw punt.'),
      zin: z.string().describe('Eén zin, bij voorkeur hooguit 25 woorden.'),
      tijd: z.string().describe('Tijdmarkering uit het transcript, mm:ss of u:mm:ss.'),
      zekerheid: zekerheid,
      afgeleid: z.boolean(),
      citaat: z.string().describe('Letterlijk fragment uit het transcript, max. 20 woorden.'),
      moment: moment.optional(),
      aanvulling: z
        .array(z.string())
        .describe(
          'Wat de instructie aan dit punt toevoegt; leeg als de instructie er niet op slaat.',
        ),
    }),
  ),
  toelichting: z.string().describe('Eén korte zin over het resultaat, of een lege tekst.'),
});

export type RefinementOutput = z.infer<typeof refinementOutputSchema>;

const storedTakeaway = z.object({
  zin: z.string(),
  tijd: z.string(),
  seconden: z.number(),
  zekerheid: zekerheid,
  afgeleid: z.boolean(),
  citaat: z.string(),
  onbevestigd: z.boolean(),
  moment: moment.optional(),
  aanvulling: z.array(z.string()).optional(),
  nieuw: z.boolean().optional(),
});

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
    moment: moment.optional(),
  }),
  takeaways: z.array(storedTakeaway),
  inhoudsoordeel: z.object({ dichtheid: dichtheid, toelichting: z.string() }),
  isInterview: z.boolean(),
  transcriptKwaliteit: kwaliteit,
  verfijningen: z.array(suggestion).optional(),
  verfijnd: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        instructie: z.string(),
        aangemaaktOp: z.string(),
        model: z.string(),
        takeaways: z.array(storedTakeaway),
        toelichting: z.string(),
      }),
    )
    .optional(),
});

type JsonObject = Record<string, unknown>;

/**
 * JSON Schema for the model output, in the subset both providers accept:
 * every object closed with additionalProperties:false and all properties required.
 */
export function modelOutputJsonSchema(): JsonObject {
  return toProviderSchema(modelOutputSchema);
}

/** JSON Schema for a refinement answer, in the same subset. */
export function refinementJsonSchema(): JsonObject {
  return toProviderSchema(refinementOutputSchema);
}

function toProviderSchema(zodSchema: z.ZodType): JsonObject {
  const schema = z.toJSONSchema(zodSchema, { target: 'draft-7' }) as JsonObject;
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

export type ParseResult<T = ModelOutput> = { ok: true; value: T } | { ok: false; error: string };

export function parseModelOutput(text: string): ParseResult {
  return parseWith(modelOutputSchema, text);
}

export function parseRefinementOutput(text: string): ParseResult<RefinementOutput> {
  return parseWith(refinementOutputSchema, text);
}

function parseWith<T>(schema: z.ZodType<T>, text: string): ParseResult<T> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Ongeldige JSON: ${(e as Error).message}` };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, value: result.data };
}
