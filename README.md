<img src="apps/extension/public/icon/128.png" width="72" alt="Logo van The Point: een afspeeldriehoekje gevolgd door een punt">

# The Point

**Weet waar een video over gaat voordat je hem kijkt.** The Point maakt een AI-samenvatting van een YouTube-video: het kernpunt en de belangrijkste takeaways, elk met een tijdstempel waarmee je direct naar de onderbouwing in de video springt. Het logo zegt het al: ▶. — de video, en dan *the point*.

The Point bestaat uit twee delen met dezelfde samenvattingsengine:

- een **browserextensie voor Chrome en Edge**, die de samenvatting naast de video op youtube.com toont;
- een **Android-app**: deel een video vanuit de YouTube-app of de browser en je krijgt de samenvatting op je telefoon.

Alleen voor eigen gebruik; je gebruikt je eigen API-sleutel van Anthropic (Claude) of Google (Gemini).

## Browserextensie

### Wat je krijgt

- **Aan/uit-schakelaar** in de kop van het paneel (standaard aan). Uit: er worden geen samenvattingen gemaakt, ook niet via thumbnails; aan: de video wordt direct samengevat.
- **Paneel op de kijkpagina**, boven de aanbevelingen (bij een smal venster onder de speler). Klik op een tijdstempel en de speler springt naar dat moment.
- **Markeringen op de tijdbalk** van de speler voor elke takeaway (wit = kritiek punt).
- **Knop in de spelerbalk** (het logo ▶.): in volledig scherm toont die de samenvatting als overlay in de video.
- **Knop "Samenvat" op thumbnails** (homepagina, zoekresultaten, aanbevelingen): opent een popover met de samenvatting. Thumbnails die al een samenvatting hebben, krijgen een geel ▶.-icoon.
- **Voorlezen**: met *Voorlezen* (🔈) leest de browser de samenvatting voor; het punt dat wordt voorgelezen licht op en de video pauzeert. Elke takeaway heeft ook een eigen 🔈-knop (bij hover). Kies de stem in het paneel of in de opties; de laatst gekozen stem wordt per taal onthouden. De stemmen zijn gratis: ze komen van de browser en Windows. Edge heeft de meeste natuurlijke stemmen (bv. "Fenna" en "Maarten"); in Chrome is "Google Nederlands" beschikbaar, en Windows-stemmen zoals "Frank" na installatie van het Nederlandse spraakpakket (*Instellingen › Tijd en taal › Spraak*).
- **Cache per video**: elke video wordt één keer samengevat; "Opnieuw" (↻) maakt een nieuwe.
- **Zonder transcript** kan Gemini de video zelf bekijken (trager en duurder; bij lange video's eerst een bevestigingsvraag).
- Labels bij takeaways: *bewering*, *mening* of *gerucht* als het geen vaststaand feit is, *berekend* als een verhouding is uitgerekend, en ⚠ als het citaat of een getal niet letterlijk in het transcript staat. Het citaat zie je als je de muis op een takeaway houdt.

### Installeren (uitgepakte extensie)

Vereist: Node.js 20 of nieuwer.

```bash
npm install
npm run build
```

De extensie staat dan in `apps/extension/.output/chrome-mv3`.

**Chrome**
1. Ga naar `chrome://extensions`.
2. Zet rechtsboven **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `apps/extension/.output/chrome-mv3`.

**Edge**
1. Ga naar `edge://extensions`.
2. Zet links **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `apps/extension/.output/chrome-mv3`.

Na een nieuwe build: klik bij de extensie op het herlaadicoon (↻) en vernieuw de YouTube-tab.

### Instellen

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

## Android-app

**Download:** [`apk/ThePoint-0.1.0.apk`](apk/ThePoint-0.1.0.apk) (ondertekende release-build, Android 7 of nieuwer). Open de link op je telefoon, kies *Download* (*View raw*) en installeer; sta daarbij *installeren uit onbekende bronnen* toe voor je browser of bestandsbeheerder. Open de app, tik op het tandwiel en vul je API-sleutel in.

### Wat je krijgt

- **Delen → The Point** vanuit de YouTube-app of Chrome, of plak een link in de app. Een tijd in de link (`?t=`) wordt meegenomen.
- **Dezelfde samenvatting** als in de extensie: kernpunt, takeaways met tijdstempels en labels, en een cache per video (*Recent* op het startscherm).
- **YouTube-player aan/uit** met de knop ▶ in de titelbalk; standaard uit. Staat de player uit, dan vraagt een tik op een tijdstempel wat je wilt: de player tonen en naar dat moment springen, **de onderbouwing laten voorlezen** (de takeaway met het citaat uit het transcript), of annuleren.
- **Voorlezen** met de stemmen van Android; voorlezen pauzeert de video.
- Licht en donker thema volgen het systeem.

Sleutels staan in de beveiligde opslag van Android (Keystore), instellingen en cache in de opslag van de app; back-ups van de app staan uit.

### Zelf bouwen

Vereist: Node.js 20 of nieuwer, JDK 21 en de Android SDK (via Android Studio). Zet `JAVA_HOME` op de JDK 21 en `ANDROID_HOME` op de SDK.

```bash
npm install
npm run build -w @the-point/mobile
cd apps/mobile
npx cap sync android
cd android
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

De APK staat dan in `apps/mobile/android/app/build/outputs/apk/debug/ThePoint-0.1.0-debug.apk`. Installeer hem met `adb install <apk>` of zet hem op je telefoon en sta *installeren uit onbekende bronnen* toe. Open de app, tik op het tandwiel en vul je API-sleutel in.

Voor een ondertekende release-build (`assembleRelease`) maak je een eigen sleutel en een `apps/mobile/android/keystore.properties` met `storeFile`, `storePassword`, `keyAlias` en `keyPassword` (staat niet in git).

## Ontwikkelen


| Commando | Doel |
|---|---|
| `npm run dev` / `npm run dev:edge` | Ontwikkelen met hot reload in Chrome / Edge |
| `npm run build` | Productiebuild van de extensie naar `apps/extension/.output/chrome-mv3` |
| `npm run build -w @the-point/mobile` | Build van de app (daarna `npx cap sync android` in `apps/mobile`) |
| `npm run typecheck` / `npm run lint` | TypeScript en ESLint |
| `npm run try -- <videoId of fixture> [--provider gemini] [--video] [--save]` | Echte samenvatting buiten de extensie; sleutels uit `.env.local` (`ANTHROPIC_API_KEY=…`, `GEMINI_API_KEY=…`) |
| `npm run secrets` | Scant alle git-bestanden op API-sleutels; als pre-commit-hook: `npm run secrets -- --install` |

De repository bestaat uit npm-workspaces: `packages/core` (samenvattingsengine, transcript ophalen en de weergave van een samenvatting, zonder browser-API's), `apps/extension` (de Chromium-extensie) en `apps/mobile` (de Android-app, Capacitor). Alle commando's draai je vanuit de hoofdmap.

Documentatie, tests en de end-to-end-test staan in een aparte, privé ontwikkelrepository.

## Bekende beperkingen

- Transcripts komen via een niet-officiële route van YouTube; als YouTube die afsluit, valt de extensie terug op het transcriptpaneel en daarna op Gemini.
- Shorts, privé- en leeftijdsbeperkte video's worden niet ondersteund.
- In de app speelt een video alleen in een zichtbare player (regels van YouTube); zonder player hoor je de onderbouwing als voorgelezen citaat, niet als geluid uit de video.
- De API-sleutel staat op je eigen apparaat; deel de extensie of de app niet met anderen zonder eigen backend. Gebruik bij voorkeur een aparte sleutel met een bestedingslimiet (Anthropic Console › Limits, Google AI Studio/Cloud › quota).

## Licentie

MIT, zie [LICENSE](LICENSE).
