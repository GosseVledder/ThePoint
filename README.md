# YouTube AI-samenvatter

Browserextensie voor Chrome en Edge die een AI-samenvatting van een YouTube-video toont **voordat** je hem bekijkt: het kritieke punt en de takeaways, elk met een klikbare tijdstempel. Alleen voor eigen gebruik; je gebruikt je eigen API-sleutel van Anthropic (Claude) of Google (Gemini).

## Wat je krijgt

- **Paneel op de kijkpagina**, boven de aanbevelingen (bij een smal venster onder de speler). Klik op een tijdstempel en de speler springt naar dat moment.
- **Markeringen op de tijdbalk** van de speler voor elke takeaway (wit = kritiek punt).
- **Knop in de spelerbalk** (✦): in volledig scherm toont die de samenvatting als overlay in de video.
- **Knop "Samenvat" op thumbnails** (homepagina, zoekresultaten, aanbevelingen): opent een popover met de samenvatting. Thumbnails die al een samenvatting hebben, krijgen een geel ✦-icoon.
- **Voorlezen**: met *Voorlezen* (🔈) leest de browser de samenvatting voor; het punt dat wordt voorgelezen licht op en de video pauzeert. Elke takeaway heeft ook een eigen 🔈-knop (bij hover). Kies de stem in het paneel of in de opties; de laatst gekozen stem wordt per taal onthouden. De stemmen zijn gratis: ze komen van de browser en Windows. Edge heeft de meeste natuurlijke stemmen (bv. "Fenna" en "Maarten"); in Chrome is "Google Nederlands" beschikbaar, en Windows-stemmen zoals "Frank" na installatie van het Nederlandse spraakpakket (*Instellingen › Tijd en taal › Spraak*).
- **Cache per video**: elke video wordt één keer samengevat; "Opnieuw" (↻) maakt een nieuwe.
- **Zonder transcript** kan Gemini de video zelf bekijken (trager en duurder; bij lange video's eerst een bevestigingsvraag).
- Labels bij takeaways: *bewering*, *mening* of *gerucht* als het geen vaststaand feit is, *berekend* als een verhouding is uitgerekend, en ⚠ als het citaat of een getal niet letterlijk in het transcript staat. Het citaat zie je als je de muis op een takeaway houdt.

## Installeren (uitgepakte extensie)

Vereist: Node.js 20 of nieuwer.

```bash
npm install
npm run build
```

De extensie staat dan in `.output/chrome-mv3`.

**Chrome**
1. Ga naar `chrome://extensions`.
2. Zet rechtsboven **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `.output/chrome-mv3`.

**Edge**
1. Ga naar `edge://extensions`.
2. Zet links **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `.output/chrome-mv3`.

Na een nieuwe build: klik bij de extensie op het herlaadicoon (↻) en vernieuw de YouTube-tab.

## Instellen

Klik op het icoon van de extensie in de werkbalk (of kies *Extensieopties*). Daar stel je in:

- **AI-dienst**: Claude of Gemini, met per dienst een API-sleutel en een model. Met **Test verbinding** controleer je sleutel en model zonder kosten.
  - Claude-sleutel: <https://console.anthropic.com/settings/keys>. Standaardmodel `claude-opus-5-5`.
  - Gemini-sleutel: <https://aistudio.google.com/apikey>. Standaardmodel `gemini-flash-latest`.
- **Taal** van de samenvatting (standaard Nederlands).
- Automatisch samenvatten, video pauzeren tot de samenvatting klaar is, markeringen op de tijdbalk.
- Gemini-terugval zonder transcript en de duur waarboven eerst bevestiging wordt gevraagd.
- Voorlezen: stem en snelheid, met *Test stem*.
- Cache wissen en een debuglog (provider, model, invoerlengte, duur, tokens per aanroep).

Sleutels staan alleen in je browser, in de eigen opslag van de extensie (IndexedDB), nooit in de code of de repository. YouTube-pagina's en de scripts die de extensie in YouTube uitvoert kunnen ze niet lezen; alleen de achtergrond (voor de AI-aanroepen) en de optiespagina gebruiken ze. De sleutel gaat alleen naar `api.anthropic.com` of `generativelanguage.googleapis.com`, in een header (niet in de URL), en komt niet in het debuglog.

## Ontwikkelen


| Commando | Doel |
|---|---|
| `npm run dev` / `npm run dev:edge` | Ontwikkelen met hot reload in Chrome / Edge |
| `npm run build` | Productiebuild naar `.output/chrome-mv3` |
| `npm run typecheck` / `npm run lint` | TypeScript en ESLint |
| `npm run try -- <videoId of fixture> [--provider gemini] [--video] [--save]` | Echte samenvatting buiten de extensie; sleutels uit `.env.local` (`ANTHROPIC_API_KEY=…`, `GEMINI_API_KEY=…`) |
| `npm run secrets` | Scant alle git-bestanden op API-sleutels; als pre-commit-hook: `npm run secrets -- --install` |

Documentatie, tests en de end-to-end-test staan in een aparte, privé ontwikkelrepository.

## Bekende beperkingen

- Transcripts komen via een niet-officiële route van YouTube; als YouTube die afsluit, valt de extensie terug op het transcriptpaneel en daarna op Gemini.
- Shorts, privé- en leeftijdsbeperkte video's worden niet ondersteund.
- De API-sleutel staat in de browser; deel deze extensie niet met anderen zonder eigen backend. Gebruik bij voorkeur een aparte sleutel met een bestedingslimiet (Anthropic Console › Limits, Google AI Studio/Cloud › quota).

## Licentie

MIT, zie [LICENSE](LICENSE).
