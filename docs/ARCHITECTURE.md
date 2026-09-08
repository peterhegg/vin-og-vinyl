# Arkitektur — Vin og vinyl

**Status:** Vedtatt · **Dato:** 2026-09-08 · **Fase:** 1 · **Besluttet av:** Peter Hegg

Låser strukturen for den kombinerte appen før vinyl-koden skrives. Åtte beslutninger
(ADR-1 … ADR-8). Feltlisten for vinyl står i `PLAN.md` og låses i Fase 2.

---

## Kontekst

Dagens app: React 18 + Vite + `vite-plugin-pwa`, ~1 700 linjer i `src/`, uten
ruter-bibliotek og uten testrammeverk. All data i IndexedDB (`vinkjeller-db`, versjon 1,
én store `wines`). Vinmonopolet nås via en Cloudflare Worker-proxy som holder API-nøkkelen.
Ingen konto, ingen backend utover proxyen. Distribusjon: GitHub Pages på `/vin-og-vinyl/`.

Vinyl kommer inn som en likeverdig samling med egen datamodell, eget søk (Discogs) og eget
filter. Denne fasen avgjør hvor grensene går, slik at Fase 2–6 kan skrives uten å flytte
kode etterpå.

Rammer som ligger fast fra `PLAN.md`:

- `DB_NAME = "vinkjeller-db"` endres ikke (intern nøkkel, ikke synlig for bruker).
- `wines`-storen migreres ikke.
- Ingen ny hemmelighet i klienten; Discogs-token bor i Worker.
- Én PWA, ikke to apper.

Ikke-funksjonelle krav som styrer valgene: mobil førstevalg, offline alltid, kald oppstart
skal være rask på telefon, én utvikler, ingen leveransefrist, lav vedlikeholdsbyrde.

## Beslutninger

| # | Beslutning | Trer i kraft |
|---|-----------|--------------|
| ADR-1 | Mappestruktur: `shared/` · `wine/` · `vinyl/` | Fase 1 → 5 |
| ADR-2 | Eget navigasjonslag, ingen ruter-bibliotek | Fase 5 |
| ADR-3 | Én IndexedDB-base, én delt åpner, versjonsstige til v2 | Fase 2 |
| ADR-4 | Coverbilder: miniatyr i posten, fullbilde i egen store | Fase 2 |
| ADR-5 | Komponentgrense: delt = null kunnskap om domenefelt | Fase 4–5 |
| ADR-6 | Sikkerhetskopi-format v2 med v1-lesing | Fase 6 |
| ADR-7 | Skjemakonvensjoner: engelske enum-verdier, navngiving, duplikater | Fase 2 |
| ADR-8 | Ett stilark, samlingsaksent via `data-collection` | Fase 5 → 7 |

---

## ADR-1: Mappestruktur

### Kontekst

`src/components/` og `src/hooks/` er flate og vin-spesifikke. Med to samlinger dobles
antallet komponenter, og «hvilke av disse er felles?» blir umulig å lese ut av trestrukturen.

### Alternativer

| | A: Domenemapper | B: Flatt, prefiks i filnavn | C: Type-mapper (`components/`, `hooks/`) |
|---|---|---|---|
| Kompleksitet | Lav | Lavest | Lav |
| Leser man grensen? | Ja | Nei | Nei |
| Import-støy | Middels | Lav | Middels |
| Flyttekostnad nå | ~20 filer | 0 | 0 |

### Beslutning

Domenemapper (A):

```
src/
  main.jsx  App.jsx  constants.js  sw.js  styles/index.css
  shared/
    sanitize.js  idb.js  proxyClient.js  backup.js
    useNav.js  useOnlineStatus.js  useBarcode.js
    components/  BarcodeScanner  PhotoCapture  RatingInput
                 SegmentedToggle  FilterShell  ExportImport
  wine/
    wineSchema.js  useWineDB.js  WineScreen.jsx
    components/  WineForm  WineCard  WineDetail  WineSearch  WineFilterBar
  vinyl/
    recordSchema.js  useRecordDB.js  useDiscogs.js  VinylScreen.jsx
    components/  RecordForm  RecordCard  RecordDetail  RecordSearch  RecordFilterBar
```

`src/data/` og `src/hooks/` forsvinner. Flyttingen skjer trinnvis, aldri som én stor commit:

- **Fase 1:** `shared/sanitize.js` opprettes med det virkelige innholdet;
  `data/wineSchema.js` re-eksporterer de to funksjonene så ingen import brekker.
  `vinyl/recordSchema.js` opprettes som stubbe.
- **Fase 2–4:** all ny vinyl-kode og alle nye delte filer fødes på riktig sti.
- **Fase 5:** vin-filene flyttes til `wine/` i én mekanisk commit.

### Konsekvenser

- Lettere: å se om en fil er delt, og å slette en hel samling hvis det noen gang trengs.
- Vanskeligere: Fase 5 får én støyende flyttecommit. Gjøres alene, uten annen endring.
- Å revidere: hvis `shared/` vokser forbi ~15 filer bør den få undermapper.

---

## ADR-2: Navigasjon

### Kontekst

`App.jsx` holder i dag all navigasjon i tre `useState` (`tab`, `detailId`, `formInitial`)
med betinget rendering. Med to samlinger blir det fire dimensjoner. To reelle svakheter i
dagens løsning: maskinvare-tilbakeknappen på Android lukker appen i stedet for å gå ett
skjermbilde tilbake, og ingen tilstand overlever en reload.

### Alternativer

| | A: Eget nav-lag m/ History API | B: `react-router` | C: Som i dag, bare utvidet |
|---|---|---|---|
| Kompleksitet | ~50 linjer | Bibliotek + basisti-oppsett | 0 |
| Bundle | 0 | ~12 kB gzip | 0 |
| Tilbakeknapp | Virker | Virker | Virker ikke |
| Delbare lenker | Nei (hash mulig) | Ja | Nei |
| Kobling mot `base`/SW | Ingen | Må holdes i synk to steder | Ingen |

### Beslutning

A. `shared/useNav.js` eier én tilstand:

```js
{ collection: "wine" | "vinyl", tab: "list" | "add" | "settings",
  detailId: string | null, form: null | { mode, initial } }
```

Hvert skjermbytte gjør `history.pushState`, og `popstate` leser tilstanden tilbake.
Tilbakeknappen popper detalj → skjema → fane → ut av appen.

Skallet:

```
App
├── CollectionSwitch  (segment: Vin | Vinyl)  — kun på fanene «Samling» og «Legg til»
├── WineScreen | VinylScreen | SettingsScreen
└── BottomNav  (Samling · Legg til · Innstillinger)  — skjules i detalj/skjema
```

Vurdert og forkastet: fire bunn-faner (`Vin · Vinyl · Legg til · Innstillinger`). Da blir
det tvetydig hvilken samling «Legg til» gjelder, og bunnraden blir trang på små skjermer.

Delbare lenker er ikke et krav for en lokal-først app, så URL-en holdes uendret og
`start_url` i manifestet fungerer som før. Skulle det bli ønskelig senere, kan `useNav`
serialisere til hash uten at noe annet endres.

Ingen egen forside/dashbord. Segmentkontrollen *er* forsiden; en kombinert tellelinje
(«N viner · M plater») ligger rett under segmentet.

### Konsekvenser

- Lettere: tilbakeknapp som oppfører seg som en app; all navigasjonslogikk ett sted.
- Vanskeligere: `useNav` må testes manuelt i Fase 10 (frem/tilbake, dyp detalj, reload).
- Å revidere: hvis delbare lenker eller flere enn ~8 skjermbilder blir aktuelt, bytt til B.

---

## ADR-3: IndexedDB

### Kontekst

`useWineDB.js` har i dag en `dbPromise` på modulnivå, `DB_VERSION = 1` og én
`onupgradeneeded`. Hvis `useRecordDB` åpner samme base med versjon 2 på egen hånd, avhenger
resultatet av hvilken hook som laster først: den ene får `VersionError`, eller oppgraderingen
blokkeres av den åpne forbindelsen. Dette er den eneste virkelig farlige koblingen i hele
utvidelsen.

### Alternativer

| | A: Én base, delt åpner | B: To baser (`wines-db`, `records-db`) |
|---|---|---|
| Versjonskonflikt mulig | Nei (én konstant) | Nei (uavhengige) |
| Atomisk import på tvers | Ja | Nei |
| Blast radius ved feil migrering | Begge samlinger | Én samling |
| Antall forbindelser | 1 | 2 |

### Beslutning

A. `shared/idb.js` eier `DB_NAME`, `DB_VERSION` og hele oppgraderingsstigen. Både
`useWineDB` og `useRecordDB` importerer `openDB()` derfra — ingen hook åpner basen selv.

Stiger på `event.oldVersion`, slik at hvert hopp er uavhengig og fremtidige bump er trygge:

```
v0 → v1   opprett "wines" med dagens indekser
v1 → v2   opprett "records" og "covers"   (rører ikke "wines")
```

Hver `createObjectStore` er beskyttet av `objectStoreNames.contains(...)`, så en base som
allerede har storen ikke feiler.

Indekser på `records` holdes minimale: `status`, `addedAt`, `artist`, `discogsId`.
Lesestien er `getAll()` + filtrering i minnet, akkurat som for viner — flere indekser koster
ved skriving og gir null gevinst før samlingen er stor. Nye indekser krever et nytt trinn i
stigen, som strukturen allerede støtter.

Den utslagsgivende gevinsten ved én base: import kan skrive `wines`, `records` og `covers`
i **én transaksjon**, så en korrupt fil ikke kan legge igjen halve tilstanden (se ADR-6).

### Konsekvenser

- Lettere: atomisk import; én forbindelse; én sannhet om skjemaversjon.
- Vanskeligere: en feil i stigen rammer begge samlinger. Derfor: `wines`-trinnet endres aldri,
  og migreringen verifiseres i Fase 2 mot en base som faktisk står på v1.
- Å revidere: hvis en fremtidig endring krever å skrive om `wines`, tas det som eget ADR.

---

## ADR-4: Coverbilder

### Kontekst

Viner lagrer `labelImageBase64` inline i posten — en 800 px JPEG (q 0.7) blir ~80–140 kB
som base64. `getAll()` trekker alle bildene inn i minnet ved hver oppstart. For en vinkjeller
ført for hånd er det uproblematisk. En platesamling er en annen størrelsesorden: 300 plater
med cover er 25–40 MB som må deserialiseres på telefonen før første kort kan tegnes. Cover
er samtidig det mest synlige elementet i en vinyl-liste, så «dropp bildene» er ikke et svar.

### Alternativer

| | A: Alt inline (som vin) | B: Alt i egen store, lat lasting | C: Miniatyr inline + fullbilde i egen store |
|---|---|---|---|
| Oppstartskostnad | Høy | Lav | Lav |
| Kode | Minst | Mest (asynk per kort) | Mellom |
| Liste tegnes umiddelbart | Ja | Nei | Ja |

### Beslutning

C. To felt, to steder:

- `record.coverThumbBase64` — ≤ 160 px JPEG, ~8–15 kB, ligger inline i `records`.
  Alt som viser en liste bruker denne.
- `covers`-storen — `{ id: <record.id>, full: <data-URL> }`, ≤ 800 px. Leses kun av
  detaljvisningen og av eksport.

`record` har **ikke** noe `coverImageBase64`-felt; fullbildet nås alltid via `covers`.
Sletting av en plate sletter tilhørende cover i samme transaksjon.

Vin-siden endres ikke. `labelImageBase64` blir liggende inline. Asymmetrien er bevisst:
alternativet er å migrere eksisterende brukerdata, som ADR-3 slår fast at vi ikke gjør.

### Konsekvenser

- Lettere: rask kald oppstart uansett samlingsstørrelse; listevisning uten asynk-flimmer.
- Vanskeligere: to skrivesteder ved lagring og sletting; eksport må sy sammen igjen (ADR-6).
- Å revidere: viser det seg i Fase 4 at kompleksiteten ikke bærer, er fallbacken triviell —
  skriv fullbildet i `coverThumbBase64` også og la `covers` stå tom.

---

## ADR-5: Grensen mellom delt og domenespesifikt

### Kontekst

`PLAN.md` lister `PhotoCapture`, `BarcodeScanner`, `RatingInput`, `ExportImport` og
`FilterBar` som delt kode. `FilterBar` er imidlertid gjennomsyret av vinfelt (land, region,
drue, produsent, leverandør), og en «delt» komponent med to sett props som utelukker
hverandre er verre enn to komponenter.

### Beslutning

**Regelen:** en komponent er delt bare hvis den ikke kjenner et eneste vin- eller vinylfelt.
Den tar primitiver og callbacks. Kjenner den et domenefelt, hører den hjemme i `wine/` eller
`vinyl/`.

| I dag | Blir | Endring |
|---|---|---|
| `components/BarcodeScanner.jsx` | `shared/components/BarcodeScanner.jsx` | uendret |
| `hooks/useBarcode.js` | `shared/useBarcode.js` | uendret |
| `components/LabelPhoto.jsx` | `shared/components/PhotoCapture.jsx` | props `label`, `maxWidth`; kan gi to størrelser (ADR-4) |
| `components/CorkRating.jsx` | `shared/components/RatingInput.jsx` | props `max`, `glyph`; kork for vin, plate for vinyl |
| `components/WishlistToggle.jsx` | `shared/components/SegmentedToggle.jsx` | props `options`, `value` |
| `components/ExportImport.jsx` | `shared/components/ExportImport.jsx` | v2-format (ADR-6) |
| `components/FilterBar.jsx` | `shared/components/FilterShell.jsx` + `wine/components/WineFilterBar.jsx` | skallet (søkefelt, «flere filtre») deles; feltene ikke |
| `callProxy` i `useVinmonopolet.js` | `shared/proxyClient.js` | brukes også av `useDiscogs` |
| `useOnlineStatus` i `App.jsx` | `shared/useOnlineStatus.js` | flyttes ut |
| `safeExternalUrl` / `safeImageDataUrl` | `shared/sanitize.js` | flyttet i Fase 1 |
| resten av `data/wineSchema.js` | `wine/wineSchema.js` | Fase 5 |
| `hooks/useWineDB.js` | `wine/useWineDB.js` + `shared/idb.js` | Fase 2 og 5 |
| `Wine{Form,Card,Detail,Search}.jsx` | `wine/components/` | Fase 5 |

Sorteringsnøkler deles **ikke**. Hver samling har sin egen `SORT`-enum
(vin: pris, poeng · vinyl: artist, tittel, år). At `NEWEST` og `NAME_ASC` finnes to steder
er tre linjer duplisering, billigere enn et generisk sorteringsrammeverk.

### Konsekvenser

- Lettere: å legge til et vinylfelt uten å røre vinkode.
- Vanskeligere: `FilterShell` må finne en abstraksjon som holder for begge — avgjøres i Fase 4
  når vinylfiltrene faktisk finnes. Blir den kunstig, dropp den og la de to filterlinjene
  duplisere skallet.

---

## ADR-6: Sikkerhetskopi-format v2

### Kontekst

Dagens eksport er `{ wines: [...] }` og importen godtar både det og en naken array.
Formatet må romme to samlinger og fullbilder som ikke lenger ligger i posten (ADR-4), uten
at gamle filer blir uleselige.

### Beslutning

```json
{
  "app": "vin-og-vinyl",
  "version": 2,
  "exportedAt": "2026-09-08T12:00:00.000Z",
  "wines": [ /* som i v1 */ ],
  "records": [ /* med coverImageBase64 materialisert fra covers-storen */ ]
}
```

`shared/backup.js` eier både lesing og skriving:

- **Lesing.** `version === 2` → les begge listene. Mangler `version` (naken array, eller
  `{ wines: [...] }`) → v1: les kun viner. Ukjent høyere versjon → avvis med melding, ikke
  delvis import.
- **Sanering.** Hvert element gjennom `normalizeWine` / `normalizeRecord`, som saniterer via
  `shared/sanitize.js`. Ingen felt fra fil skrives usanert.
- **Skriving.** Eksport slår sammen `records` med `covers`, så fila er selvstendig og
  lesbar for et menneske.
- **Import.** Én transaksjon over `wines`, `records` og `covers` (ADR-3). Sammenslåing er
  upsert på `id`: lik id overskrives, resten legges til. `coverImageBase64` i fila splittes
  tilbake til miniatyr + `covers`-rad.

Filnavn: `vin-og-vinyl-eksport-ÅÅÅÅ-MM-DD.json`.

**Kjent begrensning å håndtere i Fase 6:** en stor samling gir en JSON-streng på titalls MB.
`JSON.stringify` på hele objektet kan slå ut på telefon. Bygg blob-en stykkevis
(header → viner → plater) i stedet for én `stringify`.

### Konsekvenser

- Lettere: én fil sikrer hele appen; gamle sikkerhetskopier virker fortsatt.
- Vanskeligere: eksport må lese `covers` og kan ikke lenger være rent synkron.

---

## ADR-7: Skjemakonvensjoner

### Kontekst

Viner lagrer status som norske strenger (`"smakt"`, `"ønske"`). Prosjektets regel er at kode
skrives på engelsk. `PLAN.md` foreslo `"eier"` / `"ønske"` for vinyl.

### Beslutning

1. **Enum-verdier på engelsk i all ny kode.** `RECORD_STATUS = { OWNED: "owned", WISH: "wishlist" }`.
   Norsk finnes kun i UI-etiketter, via en labelmap i komponenten.
   Vin beholder `"smakt"` / `"ønske"` som arv — å endre dem betyr å skrive om eksisterende
   brukerdata, og ADR-3 slår fast at `wines` ikke migreres. Kostnaden er lav i praksis:
   koden refererer alltid `WINE_STATUS.TASTED`, aldri strengen.
2. **`record` betyr vinylplate.** Bruk `entry` når det menes «en rad i IndexedDB», så ordet
   ikke blir tvetydig.
3. **Egenvurdering heter `myRating` (1–10) på vinyl**, mens vin beholder `myScore`.
   Skulle en kombinert «best vurdert»-visning bli aktuell, løses det med én
   `ratingOf(entry)`-hjelper, ikke ved å døpe om et felt i lagrede data.
4. **Goldmine lagres som kanonisk notasjon:** `"M"`, `"NM"`, `"VG+"`, `"VG"`, `"G+"`, `"G"`,
   `"F"`, `"P"`, med visningstekst i en egen map. To uavhengige felt: `mediaCondition`
   og `sleeveCondition`.
5. **Ingen automatisk duplikatsjekk.** Å eie to eksemplarer er legitimt. Ved lagring med en
   `discogsId` som allerede finnes, vises en advarsel som kan overstyres. Derfor indeks på
   `discogsId` (ADR-3).
6. **Alle felt finnes alltid.** `createRecord()` returnerer full form med `null`/`""`/`[]`
   som standard, slik `createWine()` gjør, så lagrede objekter har stabil nøkkelmengde.

### Konsekvenser

- Lettere: ny kode følger prosjektets språkregel; duplikater er brukerens valg.
- Vanskeligere: to statusverdier på ulikt språk i eksportfila. Dokumentert her, ikke skjult.

---

## ADR-8: Stil og tokens

### Kontekst

Ett stilark på ~500 linjer med tokens i `:root` og vin-spesifikke klassenavn
(`.wine-card`, `.wine-name`). Vinyl trenger en egen aksent uten at paletten splittes i to.

### Beslutning

- **Ett stilark.** Ingen CSS-moduler, ingen Tailwind — appen er for liten til at
  gevinsten dekker byttekostnaden.
- **Samlingsaksent via attributt.** App-skallet får `data-collection="wine" | "vinyl"`.
  Vinyl overstyrer et lite sett tokens (`--accent`, `--accent-soft`) i én regelblokk;
  strukturklasser er de samme. Burgunder forblir appens grunnstemning (Fase 7).
- **Nøytrale strukturklassenavn.** `.wine-card` → `.item-card` osv. i én mekanisk
  omdøping i Fase 5. Alternativet — en parallell `.record-card` — dupliserer CSS uten grunn.
- **Ingen kodesplitting av vinyl.** En PWA precacher hele bundelen uansett, så `React.lazy`
  ville bare flytte parse-tid, ikke spare nedlasting. Vurderes på nytt hvis `dist` passerer
  ~300 kB gzip.
- **Discogs-cover precaches ikke.** De hentes via Worker én gang og lever i IndexedDB.
  Ingen ny runtime-cache-rute i `sw.js`.

### Konsekvenser

- Lettere: én palett å vedlikeholde; temaskifte i Fase 7 blir én tokenblokk.
- Vanskeligere: stilarket vokser. Passerer det ~900 linjer, del det per domene.

---

## Avvik fra `PLAN.md`

Disse fire punktene overstyrer det som sto i planen. `PLAN.md` er oppdatert tilsvarende.

| Planen sa | Nå | Hvorfor |
|---|---|---|
| `src/data/recordSchema.js`, `src/data/sanitize.js` | `src/vinyl/recordSchema.js`, `src/shared/sanitize.js` | `src/data/` ved siden av `src/shared/` gir to steder for samme slags fil (ADR-1) |
| `coverImageBase64` inline i posten | `coverThumbBase64` inline + `covers`-store | oppstartstid ved 300+ plater (ADR-4) |
| Ny store: `records` | Nye stores: `records` + `covers` | følger av ADR-4. `wines` fortsatt urørt |
| Status `"eier"` / `"ønske"` | `"owned"` / `"wishlist"` | engelsk i kode; norsk kun i UI (ADR-7) |

## Utsatt

- **Kombinert statistikkside.** Segmentkontrollen dekker behovet. Vurderes etter Fase 8.
- **Migrering av vin-status til engelsk.** Mulig som et v2→v3-trinn senere, ikke nå.
- **Egne indekser for tunge filtre.** Legges til når en samling faktisk blir treg.
- **Testrammeverk.** Ingen i repoet, og det forblir slik. Verifisering skjer med Playwright
  i scratchpad (Fase 10), ikke i repoet.

## Handlingspunkter

- [x] Fase 1 — `shared/sanitize.js` opprettet, `wineSchema.js` re-eksporterer
- [x] Fase 1 — `vinyl/recordSchema.js` opprettet som stubbe
- [ ] Fase 2 — `shared/idb.js` med versjonsstige v1→v2 (`records` + `covers`)
- [ ] Fase 2 — `useWineDB` bytter til delt `openDB()`
- [ ] Fase 2 — `recordSchema.js` ferdigstilles per ADR-4 og ADR-7
- [ ] Fase 2 — migrering verifisert mot en base som står på v1
- [ ] Fase 3 — `shared/proxyClient.js` trukket ut, brukt av `useDiscogs`
- [x] Fase 4 — `RatingInput`, `PhotoCapture`, `SegmentedToggle`, `FilterShell` generalisert
- [x] Fase 5 — vin-filer flyttet til `wine/` (egen commit)
- [x] Fase 5 — `useNav.js` med History API
- [x] Fase 5 — `.wine-card` → `.item-card` (mekanisk omdøping)
- [ ] Fase 6 — `shared/backup.js` med v2-skriving og v1-lesing
