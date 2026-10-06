// Settings shared by the extension and the app: one schema, one set of defaults. Each
// platform stores them its own way; API keys are never part of the settings.
import { z } from 'zod';
import { DEFAULT_MODELS } from './engine/config';

export const settingsSchema = z.object({
  /** Extension: the on/off switch in the panel header. Off = no summaries are made. */
  actief: z.boolean().catch(true),
  provider: z.enum(['claude', 'gemini']).catch('claude'),
  models: z
    .object({
      claude: z.string().min(1).catch(DEFAULT_MODELS.claude),
      gemini: z.string().min(1).catch(DEFAULT_MODELS.gemini),
    })
    .catch({ ...DEFAULT_MODELS }),
  /** Language of the summary. */
  taal: z.string().min(2).catch('nl'),
  /** Start summarizing automatically when a watch page opens. */
  automatisch: z.boolean().catch(true),
  /** Pause the video until the summary is shown or the user clicks "Toch bekijken". */
  autoplayPauzeren: z.boolean().catch(false),
  /** Without transcript, let Gemini analyse the video itself (needs a Gemini key). */
  geminiTerugval: z.boolean().catch(true),
  /** Ask before the video route for videos longer than this many minutes. */
  bevestigVanafMinuten: z.number().int().min(1).max(600).catch(30),
  /** Markers for the takeaways on the player's progress bar. */
  markeringen: z.boolean().catch(true),
  /** Last chosen read-aloud voice (voiceURI) per summary language. */
  stemmen: z.record(z.string(), z.string()).catch({}),
  /** Read-aloud speed (1 = normal). */
  spreeksnelheid: z.number().min(0.5).max(2).catch(1),
  debugLog: z.boolean().catch(false),
  paneelIngeklapt: z.boolean().catch(false),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export function parseSettings(raw: unknown): Settings {
  return settingsSchema.parse(raw && typeof raw === 'object' ? raw : {});
}
