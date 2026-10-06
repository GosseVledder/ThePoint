<img src="apps/extension/public/icon/128.png" width="72" alt="Logo van The Point: een afspeeldriehoekje gevolgd door een punt">

# The Point

**Weet waar een video over gaat voordat je hem kijkt.** The Point maakt een AI-samenvatting van een YouTube-video: het kernpunt en de belangrijkste takeaways, elk met een tijdstempel waarmee je direct naar de onderbouwing in de video springt. Het logo zegt het al: ▶. — de video, en dan *the point*.

The Point bestaat uit twee delen met dezelfde samenvattingsengine:

- een **browserextensie voor Chrome en Edge**, die de samenvatting naast de video op youtube.com toont;
- een **Android-app**: deel een video vanuit de YouTube-app of de browser en je krijgt de samenvatting op je telefoon.

Alleen voor eigen gebruik; je gebruikt je eigen API-sleutel van Anthropic (Claude) of Google (Gemini).

**Talen:** de interface is standaard Nederlands en kan in de instellingen op Engels, Duits, Frans, Spaans, Italiaans of Portugees worden gezet (*Taal van de interface*). De taal van de samenvatting kies je daar los van (*Taal van de samenvatting*), uit dezelfde zeven talen.

## Downloaden

Kies wat je wilt installeren. Er is niets te bouwen: de bestanden hieronder zijn kant-en-klaar.

| Waarvoor | Download | Installeren |
|---|---|---|
| 📱 **Android** (telefoon of tablet, Android 7 of nieuwer) | [**ThePoint-0.2.0.apk**](https://github.com/GosseVledder/ThePoint/raw/master/apk/ThePoint-0.2.0.apk) (3 MB) | [Android-app installeren](#android-app-installeren) |
| 🧩 **Google Chrome** (Windows, macOS, Linux) | [**ThePoint-extension-0.2.0.zip**](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.2.0.zip) (172 kB) | [Extensie installeren in Chrome](#extensie-installeren-in-chrome) |
| 🧩 **Microsoft Edge** (Windows, macOS) | dezelfde [**ThePoint-extension-0.2.0.zip**](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.2.0.zip) | [Extensie installeren in Edge](#extensie-installeren-in-edge) |

De APK werkt alleen op Android; de zip alleen in Chrome en Edge (dezelfde extensie voor beide browsers). Firefox, Safari en iPhone/iPad worden (nog) niet ondersteund.

## Browserextensie (Chrome en Edge)

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

### Kant-en-klare extensie

| | |
|---|---|
| **Bestand** | [`ThePoint-extension-0.2.0.zip`](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.2.0.zip) (ook uitgepakt in de map [`extension/ThePoint/`](extension/ThePoint/)) |
| **Versie** | 0.2.0 |
| **Browsers** | Google Chrome en Microsoft Edge (één en dezelfde extensie) |
| **Grootte** | 172 kB |
| **SHA-256** | `da5e7130eff7c0b7b8e3ea426a28069e7bceced0044917c5bec3a5303ee4d1bb` |

De extensie staat niet in de Chrome Web Store of de Edge-invoegtoepassingen; je laadt hem als *uitgepakte extensie*. Daarvoor heeft de browser een **map** nodig, geen zip: pak de zip dus eerst uit.

**Voorbereiden (voor Chrome en Edge gelijk)**
1. **Download** [`ThePoint-extension-0.2.0.zip`](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.2.0.zip).
2. **Pak hem uit** naar een vaste plek, bijvoorbeeld `Documenten\ThePoint` (Windows: rechtsklik › *Alles uitpakken…*). In die map staat direct het bestand `manifest.json`.
3. **Laat de map staan**: de browser laadt de extensie elke keer uit deze map. Verwijder of verplaats je hem, dan verdwijnt de extensie.

Heb je de hele repository gedownload (*Code › Download ZIP*), dan kun je ook direct de map `extension/ThePoint` kiezen.

#### Extensie installeren in Chrome
1. Ga naar `chrome://extensions`.
2. Zet rechtsboven **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de uitgepakte map (die met `manifest.json`).
4. Klik op het puzzelstukje in de werkbalk en zet **The Point** vast; klik erop om je API-sleutel in te vullen (zie [Instellen](#instellen)).

#### Extensie installeren in Edge
1. Ga naar `edge://extensions`.
2. Zet links **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de uitgepakte map (die met `manifest.json`).
4. Klik op het puzzelstukje in de werkbalk en kies bij **The Point** *Weergeven op werkbalk*; klik erop om je API-sleutel in te vullen (zie [Instellen](#instellen)).

**Bijwerken (Chrome en Edge):** pak de nieuwe zip uit over de oude map heen (bestanden vervangen), klik bij de extensie op het herlaadicoon (↻) en vernieuw de YouTube-tab. Je sleutel, instellingen en samenvattingen blijven bewaard zolang je de extensie niet verwijdert.

### Zelf bouwen

Alleen nodig als je de code wilt aanpassen. Vereist: Node.js 20 of nieuwer.

```bash
npm install
npm run build
```

De extensie staat dan in `apps/extension/.output/chrome-mv3`; die map laad je op dezelfde manier als hierboven. Na een nieuwe build: klik bij de extensie op het herlaadicoon (↻) en vernieuw de YouTube-tab. Met `npm run package:extension` ververs je de kant-en-klare versie in `extension/` (map en zip).

### Instellen

Klik op het icoon van de extensie in de werkbalk (of kies *Extensieopties*). Daar stel je in:

- **AI-dienst**: Claude of Gemini, met per dienst een API-sleutel en een model. Met **Test verbinding** controleer je sleutel en model zonder kosten.
  - Claude-sleutel: <https://console.anthropic.com/settings/keys>. Standaardmodel `claude-opus-5-5`.
  - Gemini-sleutel: <https://aistudio.google.com/apikey>. Standaardmodel `gemini-flash-latest`.
- **Taal**: *Taal van de interface* (knoppen, labels, meldingen en deze optiespagina; standaard Nederlands, ook Engels, Duits, Frans, Spaans, Italiaans en Portugees) en, daar los van, *Taal van de samenvatting* (standaard Nederlands). Een andere interfacetaal geldt direct, ook in een open YouTube-tab.
- Automatisch samenvatten, video pauzeren tot de samenvatting klaar is, markeringen op de tijdbalk.
- Gemini-terugval zonder transcript en de duur waarboven eerst bevestiging wordt gevraagd.
- Voorlezen: stem en snelheid, met *Test stem*.
- Cache wissen en een debuglog (provider, model, invoerlengte, duur, tokens per aanroep).

Sleutels staan alleen in je browser, in de eigen opslag van de extensie (IndexedDB), nooit in de code of de repository. YouTube-pagina's en de scripts die de extensie in YouTube uitvoert kunnen ze niet lezen; alleen de achtergrond (voor de AI-aanroepen) en de optiespagina gebruiken ze. De sleutel gaat alleen naar `api.anthropic.com` of `generativelanguage.googleapis.com`, in een header (niet in de URL), en komt niet in het debuglog.

## Android-app

### Android-app installeren

| | |
|---|---|
| **Bestand** | [`ThePoint-0.2.0.apk`](https://github.com/GosseVledder/ThePoint/raw/master/apk/ThePoint-0.2.0.apk) (ook in de map [`apk/`](apk/)) |
| **Versie** | 0.2.0 (versionCode 2) |
| **Vereist** | Android 7.0 of nieuwer |
| **Grootte** | 3 MB |
| **SHA-256** | `d12995ba3d0e2e91756b9f9bdef04faf348ba1810ca3d2219c8c6c2745616605` |

De APK is een ondertekende release-build; hij staat niet in de Play Store.

1. **Download** de APK op je telefoon: open de link hierboven in Chrome (of download hem op je pc en zet hem via USB of Google Drive op je telefoon).
2. **Open** het gedownloade bestand (melding of *Bestanden › Downloads*).
3. Android vraagt toestemming om apps uit deze bron te installeren: kies **Instellingen › Toestaan van deze bron** en ga terug.
4. Tik op **Installeren**. Play Protect kan waarschuwen voor een onbekende ontwikkelaar; kies *Toch installeren*.
5. Open **The Point**, tik op het **tandwiel** en vul je API-sleutel van Gemini of Claude in; met *Test verbinding* controleer je hem.
6. Klaar: in de YouTube-app tik je bij een video op **Delen › The Point**.

**Bijwerken:** installeer een nieuwe APK gewoon over de oude heen; je sleutel, instellingen en samenvattingen blijven bewaard.

Controleren of het bestand ongewijzigd is (optioneel), op Windows: `certutil -hashfile ThePoint-0.2.0.apk SHA256`; op macOS/Linux: `sha256sum ThePoint-0.2.0.apk`. De uitkomst moet gelijk zijn aan de SHA-256 hierboven.

### Wat je krijgt

- **Delen → The Point** vanuit de YouTube-app of Chrome, of plak een link in de app. Een tijd in de link (`?t=`) wordt meegenomen.
- **Dezelfde samenvatting** als in de extensie: kernpunt, takeaways met tijdstempels en labels, en een cache per video (*Recent* op het startscherm).
- **YouTube-player aan/uit** met de knop ▶ in de titelbalk; standaard uit. Staat de player uit, dan vraagt een tik op een tijdstempel wat je wilt: de player tonen en naar dat moment springen, **de onderbouwing laten voorlezen** (de takeaway met het citaat uit het transcript), of annuleren.
- **Voorlezen** met de stemmen van Android; voorlezen pauzeert de video.
- **Taal van de interface** en **taal van de samenvatting** apart in te stellen (tandwiel › *Taal*); standaard Nederlands, ook Engels, Duits, Frans, Spaans, Italiaans en Portugees.
- Licht en donker thema volgen het systeem.

### Tip: YouTube en The Point naast elkaar (tablet)

Op een Android-tablet (en op grote telefoons) kun je twee apps tegelijk op het scherm zetten: links YouTube om te kijken, rechts The Point met de samenvatting.

1. Open de video in de **YouTube-app** en deel hem naar **The Point** (*Delen › The Point*), zodat de samenvatting klaarstaat.
2. Open het overzicht van recente apps (vegen vanaf de onderrand en vasthouden, of de vierkante knop).
3. Tik op het **icoon boven YouTube** en kies **Gesplitst scherm** (de naam verschilt per merk, bijvoorbeeld *Openen in gesplitst scherm* bij Samsung). Kies daarna **The Point** voor de tweede helft.
4. Sleep de **scheidingslijn** tot YouTube ongeveer 70% en The Point ongeveer 30% van het scherm heeft. Op veel tablets klikt de lijn vast op vaste standen (ongeveer ⅓, ½ en ⅔); kies dan ⅔ voor YouTube.

Laat in The Point de knop **YouTube-player** (▶ in de titelbalk) uit: de video speelt al in de YouTube-app ernaast. Een tik op een tijdstempel biedt dan aan om de onderbouwing voor te lezen.

**iPad en iPhone:** de iPad kent hetzelfde met *Split View* (de knop ··· bovenaan een app, verhouding ½ of ⅔ / ⅓), *Slide Over* (een smal zwevend venster) en op nieuwere iPads *Stage Manager* (vrij te schalen vensters). De iPhone heeft geen gesplitst scherm. The Point is er nog niet voor iPhone en iPad: een iPad-versie staat op de planning, en de browserextensie werkt niet in Safari of Chrome op iOS.

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

De APK staat dan in `apps/mobile/android/app/build/outputs/apk/debug/ThePoint-0.2.0-debug.apk`. Installeer hem met `adb install <apk>` of zet hem op je telefoon en sta *installeren uit onbekende bronnen* toe. Open de app, tik op het tandwiel en vul je API-sleutel in.

Voor een ondertekende release-build (`assembleRelease`) maak je een eigen sleutel en een `apps/mobile/android/keystore.properties` met `storeFile`, `storePassword`, `keyAlias` en `keyPassword` (staat niet in git).

## Ontwikkelen


| Commando | Doel |
|---|---|
| `npm run dev` / `npm run dev:edge` | Ontwikkelen met hot reload in Chrome / Edge |
| `npm run build` | Productiebuild van de extensie naar `apps/extension/.output/chrome-mv3` |
| `npm run package:extension` | Build plus kant-en-klare kopie in `extension/` (map `ThePoint/` en de zip) voor download |
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
