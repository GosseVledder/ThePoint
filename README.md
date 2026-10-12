<img src="apps/extension/public/icon/128.png" width="72" alt="Logo van The Point: een afspeeldriehoekje gevolgd door een punt">

# The Point

**Weet waar een video over gaat voordat je hem kijkt.** The Point maakt met AI een samenvatting van een YouTube-video: het kernpunt en de belangrijkste takeaways, elk met een tijdstempel waarmee je direct naar de onderbouwing in de video springt. Het logo zegt het al: ▶. — de video, en dan *the point*.

## Downloaden

Kant-en-klaar: downloaden, installeren, klaar. Er is niets te bouwen.

| | Download | Installeren |
|---|---|---|
| 📱 **Android-app**<br>telefoon en tablet, Android 7 of nieuwer | [**ThePoint-0.6.2.apk**](https://github.com/GosseVledder/ThePoint/raw/master/apk/ThePoint-0.6.2.apk)<br>3 MB | [Installeren op Android](#android-app-installeren) |
| 🧩 **Extensie voor Chrome en Edge**<br>Windows, macOS, Linux | [**ThePoint-extension-0.6.1.zip**](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.6.1.zip)<br>219 kB | [Installeren in Chrome of Edge](#extensie-installeren-in-chrome-of-edge) |

Daarnaast heb je een eigen API-sleutel nodig van Google (Gemini, gratis) of Anthropic (Claude, betaald); zie [API-sleutel instellen](#api-sleutel-instellen). Firefox, Safari en iPhone/iPad worden (nog) niet ondersteund. Alle versies met hun SHA-256 staan bij de [Releases](https://github.com/GosseVledder/ThePoint/releases); app en extensie [zoeken zelf naar updates](#bijwerken) via *Instellingen › Updates*.

## Waarom The Point?

Veel video's duren twintig minuten of langer, terwijl de kern in een paar zinnen past. Een titel of thumbnail vertelt je niet of de video waarmaakt wat hij belooft. The Point laat je binnen enkele seconden zien wát een video beweert en wáár in de video dat gebeurt. Zo beslis je zelf: helemaal kijken, direct naar het stuk dat je interesseert, of overslaan.

## Wat het doet

- **Kernpunt en takeaways**: de hoofdboodschap in één zin en de belangrijkste punten, elk met een tijdstempel.
- **Direct naar de onderbouwing**: tik of klik op een tijd en de video springt naar dat moment, net iets ervoor, zodat je ziet wat er gebeurt en niet alleen het commentaar erna. Slim: 10 seconden bij een gebeurtenis (crash, doelpunt), 4 bij een uitspraak, 2 bij een nieuw onderwerp; instelbaar bij *Eerder starten bij een tijd*.
- **Eerlijke labels**: *bewering*, *mening* of *gerucht* als iets geen vaststaand feit is, *berekend* als een verhouding is uitgerekend, en ⚠ als een citaat of getal niet letterlijk in het transcript staat.
- **Voorlezen** met de gratis stemmen van je browser, Windows of Android.
- **Zeven talen**: de interface en de samenvatting stel je los van elkaar in (Nederlands, Engels, Duits, Frans, Spaans, Italiaans, Portugees).
- **Eén keer samenvatten per video**: elke samenvatting wordt bewaard; opnieuw openen kost geen nieuwe AI-aanroep.

## Hoe het werkt

1. The Point haalt het **transcript** (de ondertitels) van de video op bij YouTube.
2. De **AI-dienst die jij kiest** (Gemini of Claude, met je eigen sleutel) vat het transcript samen, met bij elk punt een citaat en een tijdstempel.
3. The Point **controleert** de citaten en getallen tegen het transcript en markeert wat niet klopt met ⚠.
4. Heeft een video geen transcript, dan kan Gemini desgewenst de video zelf bekijken (trager en duurder; bij lange video's wordt het eerst gevraagd).

Er zit geen server van The Point tussen: je apparaat praat rechtstreeks met YouTube en met de AI-dienst.

## Android-app installeren

| | |
|---|---|
| **Bestand** | [`ThePoint-0.6.2.apk`](https://github.com/GosseVledder/ThePoint/raw/master/apk/ThePoint-0.6.2.apk) (ook in de map [`apk/`](apk/)) |
| **Versie** | 0.6.2 (versionCode 8) |
| **Vereist** | Android 7.0 of nieuwer |
| **Grootte** | 3 MB |
| **SHA-256** | `b2562886065202afd537666ffd8fb1bc131c9e708e865ec77eebff8bf78b9ab3` |

De APK is een ondertekende release-build; hij staat niet in de Play Store.

1. **Download** de APK op je telefoon: open de link hierboven in Chrome (of download hem op je pc en zet hem via USB of Google Drive op je telefoon).
2. **Open** het gedownloade bestand (melding of *Bestanden › Downloads*).
3. Android vraagt toestemming om apps uit deze bron te installeren: kies **Instellingen › Toestaan van deze bron** en ga terug.
4. Tik op **Installeren**. Play Protect kan waarschuwen voor een onbekende ontwikkelaar; kies *Toch installeren*.
5. Open **The Point**, tik op het **tandwiel** en vul je [API-sleutel](#api-sleutel-instellen) in; met *Test verbinding* controleer je hem.

### Zo gebruik je de app

- **Delen › The Point** vanuit de YouTube-app of Chrome, of plak een link op het startscherm. Een tijd in de link (`?t=`) wordt meegenomen.
- Je krijgt het kernpunt en de takeaways met tijdstempels en labels. Eerdere samenvattingen staan onder *Recent* op het startscherm.
- **YouTube-player aan/uit** met de knop ▶ in de titelbalk (standaard uit). Staat de player uit, dan vraagt een tik op een tijdstempel wat je wilt: de player tonen en naar dat moment springen, de video op dat moment openen in de **YouTube-app**, of de onderbouwing **laten voorlezen** (de takeaway met het citaat uit het transcript).
- **Gesplitst scherm**: staat The Point naast de YouTube-app en is de player uit, dan springt een tik op een tijdstempel direct naar dat moment in de YouTube-app ernaast.
- **Voorlezen** met de stemmen van Android; de video pauzeert zolang er wordt voorgelezen.
- Licht en donker thema volgen het systeem.

<details>
<summary><b>Tip: YouTube en The Point naast elkaar op een tablet</b></summary>

Op een Android-tablet (en op grote telefoons) zet je twee apps tegelijk op het scherm: links YouTube om te kijken, rechts The Point met de samenvatting.

1. Open de video in de **YouTube-app** en deel hem naar **The Point** (*Delen › The Point*), zodat de samenvatting klaarstaat.
2. Open het overzicht van recente apps (vegen vanaf de onderrand en vasthouden, of de vierkante knop).
3. Tik op het **icoon boven YouTube** en kies **Gesplitst scherm** (de naam verschilt per merk, bijvoorbeeld *Openen in gesplitst scherm* bij Samsung). Kies daarna **The Point** voor de tweede helft.
4. Sleep de **scheidingslijn** tot YouTube ongeveer 70% en The Point ongeveer 30% van het scherm heeft. Op veel tablets klikt de lijn vast op vaste standen (ongeveer ⅓, ½ en ⅔); kies dan ⅔ voor YouTube.

Laat in The Point de knop **YouTube-player** (▶ in de titelbalk) uit: de video speelt al in de YouTube-app ernaast. **Tik je dan op een tijdstempel, dan springt YouTube in de andere helft naar dat moment**; The Point blijft staan. Was YouTube nog niet open, dan opent het in de andere helft. Zonder YouTube Premium kan YouTube bij het openen eerst een advertentie tonen; daarna begint de video op het gekozen moment.

**iPad en iPhone:** de iPad kent hetzelfde met *Split View*, *Slide Over* en op nieuwere iPads *Stage Manager*; de iPhone heeft geen gesplitst scherm. The Point is er nog niet voor iPhone en iPad: een iPad-versie staat op de planning, en de browserextensie werkt niet in Safari of Chrome op iOS.

</details>

## Extensie installeren in Chrome of Edge

| | |
|---|---|
| **Bestand** | [`ThePoint-extension-0.6.1.zip`](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.6.1.zip) (ook uitgepakt in de map [`extension/ThePoint/`](extension/ThePoint/)) |
| **Versie** | 0.6.1 |
| **Browsers** | Google Chrome en Microsoft Edge (één en dezelfde extensie) |
| **Grootte** | 219 kB |
| **SHA-256** | `ac0b4e3ad1e28950c54ab34fc4c2bf05a2edae82805425bfe183422009f61665` |

De extensie staat niet in de Chrome Web Store of bij de Edge-invoegtoepassingen; je laadt hem als *uitgepakte extensie*. Daarvoor heeft de browser een **map** nodig, geen zip.

1. **Download** [`ThePoint-extension-0.6.1.zip`](https://github.com/GosseVledder/ThePoint/raw/master/extension/ThePoint-extension-0.6.1.zip).
2. **Pak hem uit** naar een vaste plek, bijvoorbeeld `Documenten\ThePoint` (Windows: rechtsklik › *Alles uitpakken…*). In die map staat direct het bestand `manifest.json`. **Laat de map staan**: de browser laadt de extensie elke keer uit deze map.
3. Open `chrome://extensions` (Chrome) of `edge://extensions` (Edge).
4. Zet **Ontwikkelaarsmodus** aan (Chrome: rechtsboven; Edge: links).
5. Klik **Uitgepakte extensie laden** en kies de uitgepakte map (die met `manifest.json`).
6. Klik op het puzzelstukje in de werkbalk en zet **The Point** vast (Edge: *Weergeven op werkbalk*). Klik op het icoon om de instellingen te openen en vul je [API-sleutel](#api-sleutel-instellen) in.

### Zo gebruik je de extensie

- Open een video op youtube.com: rechts naast de video (bij een smal venster eronder) verschijnt het **paneel** met de samenvatting. Klik op een tijdstempel en de speler springt naar dat moment (een paar seconden ervoor).
- **Aan/uit-schakelaar** in de kop van het paneel: uit betekent geen samenvattingen, ook niet via thumbnails.
- **Korte lijst**: bij veel takeaways toont het paneel er standaard 5 en scroll je door de rest. Het aantal stel je in bij *Zichtbare takeaways*; bij *Lijst met takeaways* kies je eventueel de volledige lijst.
- **Markeringen op de tijdbalk** van de speler voor elke takeaway (wit = kritiek punt).
- **Knop in de spelerbalk** (het logo ▶.): in volledig scherm toont die de samenvatting als overlay.
- **Knop "Samenvat" op thumbnails** (homepagina, zoekresultaten, aanbevelingen): toont de samenvatting zonder de video te openen. Thumbnails met een bewaarde samenvatting krijgen een geel ▶.-icoon.
- **Voorlezen** (🔈) in het paneel; het punt dat wordt voorgelezen licht op en de video pauzeert. Edge heeft de meeste natuurlijke stemmen (bijvoorbeeld "Fenna" en "Maarten"); in Chrome is "Google Nederlands" beschikbaar.
- **Opnieuw** (↻) maakt een nieuwe samenvatting van dezelfde video.

## API-sleutel instellen

The Point gebruikt je eigen sleutel. **Gemini is gratis te gebruiken**, met een limiet per minuut en per dag; **Claude betaal je** per samenvatting van vooraf gekocht tegoed. Er is één Gemini-sleutel: of je betaalt, hangt af van je Google-project, niet van The Point. Zolang je daar geen facturering (billing) koppelt, blijft het gratis.

| Dienst | Kosten | Sleutel aanmaken | Standaardmodel |
|---|---|---|---|
| **Gemini** (Google) | gratis, met limieten | <https://aistudio.google.com/apikey> | `gemini-flash-latest` |
| **Claude** (Anthropic) | tegoed, per samenvatting | <https://console.anthropic.com/settings/keys> | `claude-haiku-5-5` (of `claude-sonnet-5-5`, `claude-opus-5-5`) |

### Gemini-sleutel (gratis)

1. Open <https://aistudio.google.com/apikey> en log in met je Google-account.
2. Accepteer de voorwaarden (alleen de eerste keer).
3. Klik op **Create API key**; kies zo nodig een project of laat er een aanmaken.
4. Kopieer de sleutel (begint met `AIza`).
5. Open de instellingen van The Point, kies **Gemini**, plak de sleutel bij *API-sleutel* en klik op **Test verbinding**.

Koppel geen facturering aan het project als je het gratis wilt houden. Is de limiet bereikt, dan meldt The Point dat; probeer het later opnieuw.

### Claude-sleutel (betaald)

1. Open <https://console.anthropic.com/settings/keys> en maak een account aan of log in.
2. Koop tegoed onder **Billing** (vooraf betaald) en zet bij voorkeur een maximum op je uitgaven.
3. Kies **Create key** bij de API-sleutels en geef de sleutel een naam.
4. Kopieer de sleutel (begint met `sk-ant-`) meteen: je ziet hem maar één keer.
5. Open de instellingen van The Point, kies **Claude**, plak de sleutel bij *API-sleutel* en klik op **Test verbinding**.

De instellingen openen: in de extensie klik je op het icoon in de werkbalk, in de app op het tandwiel. Daar staat hetzelfde stappenplan onder **Hoe kom ik aan een sleutel?**. **Test verbinding** kost niets. Wil je ook video's zonder transcript laten samenvatten, vul dan ook een Gemini-sleutel in, ook als je Claude gebruikt. Bij elke instelling legt een ⓘ uit wat die doet.

## Bijwerken

De app (vanaf 0.5.0) en de extensie (vanaf 0.4.0) zoeken zelf de nieuwste versie op: **Instellingen › Updates › Controleren op updates**. Elke versie staat ook bij de [Releases](https://github.com/GosseVledder/ThePoint/releases).

- **App**: is er een nieuwe versie, tik dan op **Downloaden en installeren**. De app downloadt de APK, controleert de SHA-256 en opent de installatie van Android; bevestig met *Bijwerken*. De eerste keer vraagt Android om installeren via The Point toe te staan; tik daarna zo nodig nog een keer op de knop. Google Play Protect kan voorstellen de app eerst te laten scannen; dat mag, of kies *installeren zonder scannen*.
- **Extensie**: een uitgepakte extensie kan zichzelf niet vervangen, dus het zijn drie stappen op de instellingenpagina: de zip **downloaden**, hem **uitpakken over de map** van The Point heen (bestanden vervangen) en op **Herladen** klikken. De instellingenpagina opent daarna opnieuw met de nieuwe versie; vernieuw open YouTube-tabs.

Oudere versies werk je met de hand bij: installeer de nieuwe APK over de oude heen, of pak de nieuwe zip uit over de oude map en klik in `chrome://extensions` of `edge://extensions` bij The Point op het herlaadicoon (↻).

Je sleutel, instellingen en samenvattingen blijven in alle gevallen bewaard.

Controleren of een bestand ongewijzigd is (optioneel), op Windows: `certutil -hashfile <bestand> SHA256`; op macOS/Linux: `sha256sum <bestand>`. De uitkomst moet gelijk zijn aan de SHA-256 hierboven of bij de release.

## Privacy en sleutels

- **Extensie**: sleutels staan alleen in je browser, in de eigen opslag van de extensie (IndexedDB). YouTube-pagina's en de scripts die de extensie in YouTube uitvoert kunnen ze niet lezen.
- **App**: sleutels staan in de beveiligde opslag van Android (Keystore); back-ups van de app staan uit.
- De sleutel gaat alleen naar `api.anthropic.com` of `generativelanguage.googleapis.com`, in een header (niet in de URL), en staat nooit in de code of de repository.
- *Controleren op updates* vraagt alleen de nieuwste release op bij `api.github.com`; er gaan geen sleutels of andere gegevens mee.

## Bekende beperkingen

- Transcripts komen via een niet-officiële route van YouTube; als YouTube die afsluit, valt de extensie terug op het transcriptpaneel en daarna op Gemini.
- Shorts, privé- en leeftijdsbeperkte video's worden niet ondersteund.
- In de app speelt een video alleen in een zichtbare player (regels van YouTube); zonder player hoor je de onderbouwing als voorgelezen citaat, niet als geluid uit de video.
- De API-sleutel staat op je eigen apparaat; deel de extensie of de app niet met anderen zonder eigen backend.

## Broncode en zelf bouwen

Alleen nodig als je de code wilt aanpassen; voor gewoon gebruik volstaan de [downloads](#downloaden) hierboven.

De repository bestaat uit npm-workspaces: `packages/core` (samenvattingsengine, transcript ophalen en de weergave van een samenvatting, zonder browser-API's), `apps/extension` (de Chromium-extensie, WXT) en `apps/mobile` (de Android-app, Capacitor). Alle commando's draai je vanuit de hoofdmap. Vereist: Node.js 20 of nieuwer.

### Extensie bouwen

```bash
npm install
npm run build
```

De extensie staat dan in `apps/extension/.output/chrome-mv3`; die map laad je zoals [hierboven](#extensie-installeren-in-chrome-of-edge) beschreven. Met `npm run package:extension` ververs je de kant-en-klare versie in `extension/` (map en zip).

### Android-app bouwen

Vereist daarnaast JDK 21 en de Android SDK (via Android Studio). Zet `JAVA_HOME` op de JDK 21 en `ANDROID_HOME` op de SDK.

```bash
npm install
npm run build -w @the-point/mobile
cd apps/mobile
npx cap sync android
cd android
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

De APK staat dan in `apps/mobile/android/app/build/outputs/apk/debug/`. Installeer hem met `adb install <apk>`. Voor een ondertekende release-build (`assembleRelease`) maak je een eigen sleutel en een `apps/mobile/android/keystore.properties` met `storeFile`, `storePassword`, `keyAlias` en `keyPassword` (staat niet in git).

### Ontwikkelen


| Commando | Doel |
|---|---|
| `npm run dev` / `npm run dev:edge` | Ontwikkelen met hot reload in Chrome / Edge |
| `npm run build` | Productiebuild van de extensie naar `apps/extension/.output/chrome-mv3` |
| `npm run package:extension` | Build plus kant-en-klare kopie in `extension/` (map `ThePoint/` en de zip) voor download |
| `npm run build -w @the-point/mobile` | Build van de app (daarna `npx cap sync android` in `apps/mobile`) |
| `npm run typecheck` / `npm run lint` | TypeScript en ESLint |
| `npm run try -- <videoId of fixture> [--provider gemini] [--video] [--save]` | Echte samenvatting buiten de extensie; sleutels uit `.env.local` (`ANTHROPIC_API_KEY=…`, `GEMINI_API_KEY=…`) |
| `npm run secrets` | Scant alle git-bestanden op API-sleutels; als pre-commit-hook: `npm run secrets -- --install` |

Documentatie, tests en de end-to-end-test staan in een aparte, privé ontwikkelrepository.

## Licentie

MIT, zie [LICENSE](LICENSE).
