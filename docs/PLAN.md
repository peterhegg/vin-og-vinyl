# Vin og vinyl — utviklingsplan

Levende plan. Oppdateres på slutten av hver fase (kryss av + flytt «Nåværende fase»).
Enkeltkilde for status. Memory-fil: `project_vin_og_vinyl.md`.
Arkitekturen er låst i `docs/ARCHITECTURE.md` (ADR-1 … ADR-8) — les den før Fase 2–6.

Gjenoppta i ny chat: kjør `/vinyl-fase` — den leser denne fila og gir deg modell,
effort, skills og kickoff-melding for neste fase.

---

## Mål

Slå sammen dagens vin-app («Vinkjeller») og en ny vinyl-modul til **én PWA: «Vin og vinyl»**.

- To samlinger i samme app: **Vin** og **Vinyl**, hver med egen datamodell, søk og filter.
- Vinyl: registrer plater du **eier** og plater på **ønskeliste**. Rask registrering.
- Vinyl-metadata hentes fra **Discogs** via Cloudflare Worker-proxy (samme mønster som Vinmonopolet).
- Alt lokalt i IndexedDB. Ingen konto, ingen backend utover proxy.
- Navnet «Vinkjeller» byttes til «Vin og vinyl» overalt: .md, GitHub-repo, PWA-manifest, UI, URL.

## Beslutninger (2026-09-08)

| Tema | Valg |
|------|------|
| Arkitektur | Én kombinert PWA |
| Repo/URL | Døp om `vinkjeller` → `vin-og-vinyl`. Ny URL: `peterhegg.github.io/vin-og-vinyl/` |
| Vinyl-datakilde | Discogs API via Worker-proxy (søk + strekkode + cover) |
| Vinyl-grading | Goldmine-skala, separat for plate (media) og cover (sleeve) + fritekst |
| IndexedDB-navn | Beholdes internt (`vinkjeller-db`). Versjonsbump v1→v2 legger til `records` + `covers` uten å røre `wines`. Intern nøkkel, ikke synlig for bruker → ingen migrering av eksisterende data. Eksport-filnavn endres til `vin-og-vinyl-eksport-*.json`. |
| Delt DB-åpner | `src/shared/idb.js` eier `DB_NAME`, `DB_VERSION` og oppgraderingsstigen. Ingen hook åpner basen selv (ADR-3). |

## Vinyl-datamodell (oppdatert etter ADR — låses i Fase 2)

`src/vinyl/recordSchema.js` — se `docs/ARCHITECTURE.md` ADR-4 og ADR-7

| Felt | Type | Kilde |
|------|------|-------|
| `id` | uuid | auto |
| `status` | `"owned"` \| `"wishlist"` | bruker (norsk kun i UI-etikett) |
| `addedAt` / `acquiredAt` | ISO | auto / bruker |
| `artist` | string | Discogs/manuell |
| `title` | string | Discogs/manuell |
| `releaseYear` | number\|null | denne utgaven |
| `originalYear` | number\|null | original-utgivelse |
| `label` | string | Discogs |
| `catalogNumber` | string | Discogs |
| `formats` | string[] | LP, 2xLP, 7", 10", 12", Box, Picture Disc … |
| `pressingNote` | string | fritekst: «2021 reissue, 180g, gatefold, blå vinyl» |
| `country` | string | Discogs |
| `genres` | string[] | Discogs |
| `styles` | string[] | Discogs |
| `discogsId` | number\|null | Discogs release-id |
| `discogsUrl` | string (sanert) | lenke til Discogs |
| `barcode` | string\|null | strekkode |
| `coverThumbBase64` | data-URL (sanert), ≤160 px | inline i posten — brukes av lister |
| *(fullcover)* | egen `covers`-store: `{ id, full }`, ≤800 px | leses av detaljvisning + eksport |
| `mediaCondition` | Goldmine enum \| null | M, NM, VG+, VG, G+, G, F, P |
| `sleeveCondition` | Goldmine enum \| null | samme skala |
| `conditionNotes` | string | bruker |
| `myRating` | 1–10 \| null | bruker |
| `myNotes` | string | bruker |
| `purchasePriceNOK` | number\|null | bruker |
| `purchaseDate` | string | bruker |
| `purchasePlace` | string | bruker |
| `storageLocation` | string | hylle/kasse |
| `plays` | number | valgfri teller |
| `estimatedValueNOK` | number\|null | valgfri |

Delt kode (full flytteplan i ADR-5): `src/shared/sanitize.js` (`safeExternalUrl`,
`safeImageDataUrl` — flyttet i Fase 1), `PhotoCapture` (fra `LabelPhoto`), `BarcodeScanner`,
`RatingInput` (fra `CorkRating`), `SegmentedToggle` (fra `WishlistToggle`), `ExportImport`,
`FilterShell` (kun skallet av `FilterBar` — feltene forblir domenespesifikke),
`proxyClient`, `useOnlineStatus`, `idb`.

---

## Faser

Legende effort: **think** = normal grundig · **think hard** = utvidet · **ultrathink** = maks.
Bytt modell i app-ens modellvelger (øverst i Code-fanen) før du starter fasen.
`/fast` gir raskere Opus i tunge Opus-faser.

### Fase 0 — Rebrand «Vinkjeller» → «Vin og vinyl» + repo-rename
- **Modell:** Sonnet · **Effort:** think · **Egen chat:** nei
- **Skills:** ingen
- Endre navn i: `package.json`, `vite.config.js` (`base: "/vin-og-vinyl/"` + manifest `name`/`short_name`/`description`/`start_url`), `index.html` (`<title>` + ikon-stier), `src/sw.js` (`createHandlerBoundToURL`), `README.md`, `BUG-REPORT.md`, `docs/*`, `.env.example`, `wrangler.toml` (`name = "vin-og-vinyl-proxy"`), `cloudflare-worker.js` (kommentar), `.github/workflows/deploy.yml` (job-navn), `src/App.jsx` (H1), `src/components/ExportImport.jsx` (eksport-filnavn + tekst).
- **IKKE** endre `DB_NAME` i `src/hooks/useWineDB.js` (se beslutning over).
- Repo-rename (bruker/agent bekrefter): `gh repo rename vin-og-vinyl` → `git remote set-url origin …` → GitHub Pages-innstilling peker fortsatt på Actions. Repo-secrets (`VITE_PROXY_URL`, `VITE_APP_TOKEN`) beholder navn.
- Worker: bruker redeployer som `vin-og-vinyl-proxy` og oppdaterer repo-secret `VITE_PROXY_URL` (kan utsettes til Fase 11).
- **Ferdig når:** `git grep -i vinkjell` gir kun treff i `useWineDB.js` (bevisst) + `package-lock.json`.

### Fase 1 — Arkitektur for kombinert app (ADR)
- **Modell:** Opus · **Effort:** think hard · **Egen chat:** ja
- **Skills:** `architecture`, `engineering:system-design`. Evt. `Plan`-agent for skisse.
- Avklar: app-skall og navigasjon (topp-nivå Vin/Vinyl-bytte + bunn-nav per samling), delt vs. type-spesifikk komponent-grense, IndexedDB (én db, stores `wines` + `records`, versjonsbump-strategi), eksport/import-format v2, mappe­struktur (`src/wine/`, `src/vinyl/`, `src/shared/`).
- **Leveranse:** `docs/ARCHITECTURE.md` (ADR-1 … ADR-8), oppdatert datamodell i denne fila,
  `src/shared/sanitize.js` (ekte innhold, re-eksportert fra `wineSchema.js`) + `src/vinyl/recordSchema.js` (stubbe med låste enums).

### Fase 2 — Vinyl-datamodell + IndexedDB-lag
- **Modell:** Opus · **Effort:** think hard · **Egen chat:** ja (kan dele med Fase 1)
- **Skills:** ingen
- `src/vinyl/recordSchema.js`: `createRecord`, `normalizeRecord`, `RECORD_KEYS`, `clampRating` (enums er alt låst i stubben). XSS-sanering via delt `src/shared/sanitize.js`.
- `src/shared/idb.js`: felles `openDB()` med versjonsstige v1→v2 (`records` + `covers`). `useWineDB` bytter til denne — ingen hook åpner basen selv (ADR-3).
- `src/vinyl/useRecordDB.js`: speiler `useWineDB` (CRUD, `filterAndSortRecords`, `SORT`, stats) + cover-håndtering per ADR-4 (miniatyr i posten, fullbilde i `covers`, slettes i samme transaksjon).
- Verifiser migreringen mot en base som faktisk står på v1.
- **Leveranse:** grønn manuell CRUD-test i konsoll/enkel harness.

### Fase 3 — Discogs Worker-proxy + `useDiscogs`-hook
- **Modell:** Opus · **Effort:** ultrathink på proxy-sikkerhet, ellers think hard · **Egen chat:** ja
- **Skills:** `debug` ved behov
- `cloudflare-worker.js`: ruter `GET /discogs/search?q=`, `/discogs/barcode?ean=`, `/discogs/release/<id>`, `/discogs/cover/<id>`. `DISCOGS_TOKEN` som Worker-secret (aldri i klient). `CLIENT_TOKEN`-gate + KV-rate-limit beholdt (60 API/min, 30 cover/min). `User-Agent` påkrevd av Discogs. 429 videreformidles med `Retry-After`.
- Ruting matcher på siste path-segmenter, ikke `endsWith` — `/search` ville ellers slukt `/discogs/search`.
- Svar projiseres på en fast feltliste i Workeren (release ~150 kB → ~1 kB). Cache i Workeren: søk 1 t, release 1 døgn, cover 30 dager.
- Cover returneres som **bildebytes**, ikke base64 (avvik fra opprinnelig plan): strømmes gjennom uten buffering, klienten gjør blob → `compressImage` → data-URL. Bilde-URL-en kommer alltid fra Discogs' eget svar og verten sjekkes mot allowlist; redirects, feil MIME og >5 MB avvises.
- `src/vinyl/useDiscogs.js`: `search`, `lookupByBarcode`, `getRelease`, `getCover`, `mapReleaseToRecord`, `splitCombinedTitle`.
- `src/shared/proxyClient.js` trukket ut av `useVinmonopolet` og delt av begge (ADR-5).
- Oppdater `.env.example`, README API-seksjon, `wrangler.toml`. Ingen ny klient-secret.
- **Leveranse:** ende-til-ende søk mot ekte Discogs (bruker må ha lagt inn token — kan stubbes til Fase 11, da med mock).

### Fase 4 — Vinyl-UI
- **Modell:** Sonnet · **Effort:** medium (think) · **Egen chat:** ja
- **Skills:** `design-critique` på slutten
- Komponenter: `RecordSearch` (Discogs-autofyll), `RecordForm` (alle felt, Goldmine-nedtrekk media+sleeve, format-velger, år-felt), `RecordCard`, `RecordDetail`, generalisert `BarcodeScanner` (gjenbruk fra vin), `FilterBar` for vinyl (artist, sjanger, format, tiår, status, tilstand; sortering artist/tittel/år/lagt til/rating).
- Ønskeliste ↔ eier-veksling.

### Fase 5 — Kombinert navigasjon + delt skall + delt Innstillinger
- **Modell:** Sonnet · **Effort:** medium · **Egen chat:** nei (samme som Fase 4)
- `App.jsx` blir skall: segmentkontroll Vin/Vinyl, bunn-nav (Samling · Legg til · Innstillinger), felles Innstillinger (eksport/import av begge). Ingen egen forside — kombinert tellelinje under segmentet (ADR-2).
- `src/shared/useNav.js` med History API så Android-tilbakeknappen popper skjermbilder.
- Mekanisk flytting av vin-filene til `src/wine/` + omdøping `.wine-card` → `.item-card`, som egne commits (ADR-1, ADR-8).

### Fase 6 — Eksport/import v2
- **Modell:** Opus · **Effort:** medium · **Egen chat:** nei (m/ Fase 3 eller 5)
- `src/shared/backup.js`: format `{ app, version: 2, exportedAt, wines: [], records: [] }`. Bakoverkompatibel lesing av v1 (naken array eller `{ wines }`). Sanering på begge typer. Import i én transaksjon over `wines` + `records` + `covers`. Eksport materialiserer fullcover; import splitter tilbake (ADR-6).
- Bygg blob-en stykkevis — én `JSON.stringify` på hele samlingen kan slå ut på telefon.

### Fase 7 — Tema + ikoner rebrand
- **Modell:** Fable · **Effort:** medium · **Egen chat:** ja
- **Skills:** `theme-factory` (tokens), `canvas-design` (app-ikon)
- Behold burgunder vin-palett, legg til vinyl-aksent (grafitt/blekk + messing). Nytt app-ikon (vin + vinyl-motiv): 192/512/512-maskable, favicon, apple-touch. Oppdater `docs/ICON_PHILOSOPHY.md`.
- `--accent`/`--accent-soft` finnes alt (gull-alias fra Fase 4) og brukes av tellelinjas
  `data-active`, vinyl-kortene og `RatingInput` med `glyph="disc"`. Bytt dem per
  `data-collection` på `.app-shell` (ADR-8) — ikke globalt, ellers får vin-siden vinylfarge.
- Sjekk kontrasten på disc-glyfen på nytt etter fargebyttet; den ble justert i Fase 4.

### Fase 8 — Polish
- **Modell:** Sonnet · **Effort:** medium · **Egen chat:** nei
- **Skills:** `accessibility-review`, `ux-copy`
- Tomtilstander, mikrotekst, 48px trykkmål, offline-banner-tekst, tastatur/skjermleser.
- Innstillinger har nå fire importmeldinger (ugyldig fil, for ny versjon, tom fil, feilet
  import) + to travle knappetilstander. Gå gjennom dem med `ux-copy`.
- **Reell mangel funnet i Fase 6:** når begge samlinger er tomme er eksport-knappen
  `disabled` uten et ord om hvorfor. Innstillinger trenger en tomtilstand.

### Fase 9 — Sikkerhetsgjennomgang
- **Modell:** Opus · **Effort:** think hard · **Egen chat:** ja
- **Skills:** `/sikkerhetsanalyse` (auto), deretter `/bugreview`
- Fokus: Discogs-proxy (SSRF, token-lekkasje, CORS, rate-limit), import-sanering på nye felt, XSS i nye felt, CSP.
- Nytt etter Fase 6 — `shared/backup.js` er eneste vei inn i basen, så den er hele
  angrepsflaten for importerte data:
  - Prototypeforurensning: en fil kan inneholde `__proto__`/`constructor` som nøkler.
    `JSON.parse` lager egne felt (trigger ikke setteren) og `createRecord`/`createWine`
    leser bare navngitte felt, men verifiser det — det er ikke testet.
  - Datatap som angrep: en importfil kan slette cover-rader for plater brukeren alt har,
    ved å oppgi samme `id` uten cover. Det er bevisst (ellers arver posten feil bilde),
    men vurder om import bør si fra hva som overskrives.
  - Ingen størrelsesgrense på importfil. `file.text()` + `JSON.parse` på en flere hundre
    MB stor fil kan drepe fanen på telefon. Vurder et tak med tydelig feilmelding.
  - `saveBlob` holder object-URL-en i live i 60 s. Sjekk at ingenting lekker.

### Fase 10 — Test + verifiser prod-bundle
- **Modell:** Sonnet · **Effort:** medium · **Egen chat:** nei (m/ Fase 9)
- **Skills:** `run`
- Playwright i scratchpad (ikke i repo, som sist). Bygg prod-bundle, verifiser vin + vinyl-flyt, offline, PWA-install.
- Ta med eksport → import-rundturen i prod-bundle: last ned ekte fil, tøm basen, importer
  tilbake, sjekk at cover er med. Det er kun verifisert på dev-serveren så langt.
- Harness-gotchaer (kostet tid i Fase 6):
  - Dev-serveren serverer under base-stien: `http://localhost:<port>/vin-og-vinyl/…`,
    både for harness-sida og for `await import('/vin-og-vinyl/src/…')`.
  - `getAll()` gir **nøkkelrekkefølge**, ikke innsettingsrekkefølge (`w1, w10, w100`).
    Sammenlign på `id`, aldri på indeks.
  - Antall IndexedDB-transaksjoner kan telles ved å midlertidig wrappe
    `IDBDatabase.prototype.transaction` — den enkleste måten å bevise atomisitet på.

### Fase 11 — Deploy-handoff + memory
- **Modell:** Sonnet · **Effort:** low · **Egen chat:** nei
- Skriv nøyaktig sjekkliste for bruker: (1) `gh repo rename vin-og-vinyl` hvis ikke gjort, (2) Discogs-token på discogs.com/settings/developers, (3) `wrangler secret put DISCOGS_TOKEN`, (4) redeploy Worker som `vin-og-vinyl-proxy`, (5) oppdater repo-secret `VITE_PROXY_URL`, (6) sjekk GitHub Pages, (7) re-run workflow.
- Oppdater `project_vin_og_vinyl.md` med endelig status. Arkiver `project_vinkjeller.md`.

---

## Modell- og token-strategi

- **Opus:** datalag, schema, IndexedDB-migrering, Discogs-proxy, sikkerhet, eksport/import (Fase 1, 2, 3, 6, 9).
- **Sonnet:** UI, komponenter, navigasjon, scaffold, rebrand, polish, test (Fase 0, 4, 5, 8, 10, 11).
- **Fable:** tema + ikoner (Fase 7).
- Bytt modell i app-ens modellvelger før hver fase. Sett effort med «think» / «think hard» / «ultrathink» i kickoff-meldingen.
- **Ny chat** ved fase merket «Egen chat: ja» — sparer kontekst. Start ny chat med `/vinyl-fase`.

## Fremdrift

- [x] Fase 0 — Rebrand + repo-rename ✓ 2026-09-08
- [x] Fase 1 — Arkitektur (ADR) ✓ 2026-09-08
- [x] Fase 2 — Vinyl-datamodell + DB ✓ 2026-09-08
- [x] Fase 3 — Discogs-proxy ✓ 2026-09-08
- [x] Fase 4 — Vinyl-UI ✓ 2026-09-08
- [x] Fase 5 — Kombinert navigasjon ✓ 2026-09-08
- [x] Fase 6 — Eksport/import v2 ✓ 2026-09-08
- [ ] Fase 7 — Tema + ikoner
- [ ] Fase 8 — Polish
- [ ] Fase 9 — Sikkerhet
- [ ] Fase 10 — Test
- [ ] Fase 11 — Deploy-handoff

**Nåværende fase:** Fase 7 — Tema + ikoner. Fable, medium. Egen chat.

Fase 0 gjort: navn byttet i alle filer (DB_NAME bevisst beholdt), repo renamet på
GitHub til `vin-og-vinyl` (remote oppdatert, redirect aktiv), prod-bygg verifisert
med base `/vin-og-vinyl/`. Gjenstår for bruker (Fase 11): redeploy Worker som
`vin-og-vinyl-proxy` + oppdater repo-secret `VITE_PROXY_URL`.

Fase 1 gjort: `docs/ARCHITECTURE.md` med ADR-1 … ADR-8. Fire avvik fra den opprinnelige
planen, dokumentert i ADR-ens «Avvik»-tabell og innarbeidet her: nye filstier
(`src/vinyl/`, `src/shared/` i stedet for `src/data/`), coverbilder splittet i
miniatyr + `covers`-store, `covers` som ekstra objectstore, og engelske statusverdier
(`"owned"` / `"wishlist"`). `src/shared/sanitize.js` og `src/vinyl/recordSchema.js`
opprettet, prod-bygg fortsatt grønt.

Fase 2 gjort: `src/shared/idb.js` (delt åpner, versjonsstige v1→v2), `src/shared/image.js`
(`compressImage` + `makeThumbnail`), ferdig `src/vinyl/recordSchema.js` og
`src/vinyl/useRecordDB.js` (CRUD + cover-splitting + `filterAndSortRecords` + `SORT` + stats).
`useWineDB` bruker nå den delte åpneren. Verifisert i nettleser mot en base som faktisk
sto på v1: 54 assertions grønne — migrering bevarer viner og indekser, cover-splitting,
sanering av fiendtlig import-input, filter/sortering, og vin-siden uten regresjon.

Fase 3 gjort: Discogs-ruter i Workeren + `src/vinyl/useDiscogs.js` + delt
`src/shared/proxyClient.js`. 59 assertions mot mocket oppstrøm (scratchpad, ikke i repo)
dekker SSRF på syv angreps-URL-er, token-lekkasje, CORS, input-validering, 429/Retry-After
og at Vinmonopolet-ruten er uendret. **Fant og fikset en ekte rutingsbug:** `/discogs/search`
traff Vinmonopolet-ruten fordi `endsWith("/search")` også matcher den. Rutingen matcher nå
path-segmenter. Gjenstår for bruker (Fase 11): `wrangler secret put DISCOGS_TOKEN` + redeploy —
uten den svarer Discogs-rutene 503 mens vin-søket virker som før.

Fase 4 gjort: generaliserte delte komponenter — `shared/components/SegmentedToggle.jsx`
(fra WishlistToggle), `RatingInput.jsx` (fra CorkRating; `glyph="cork"|"disc"`, `max`),
`PhotoCapture.jsx` (fra LabelPhoto; bruker delt `image.js`), `FilterShell.jsx` (søkefelt +
«flere filtre»-skall). `BarcodeScanner` + `useBarcode` flyttet til `shared/` med `git mv`.
Vin-komponentene (WineForm/Card/Detail/Search, FilterBar) peker nå på de delte — de gamle
kopiene slettet. Vinyl-UI: `vinyl/components/RecordSearch` (Discogs 2-stegs: søk → pick →
release+cover), `RecordForm` (kort kjerne + «Flere detaljer»-kollaps, Goldmine-nedtrekk
media+sleeve, format-chips + fritekst, år-felt m/ forklaring), `RecordCard`, `RecordDetail`
(fullcover via `getCover`, status-veksling), `RecordFilterBar` (artist/selskap/sjanger/stil/
format/tiår/tilstand + 6 sorteringer). `vinyl/VinylScreen.jsx` komponerer det hele.
**Midlertidig:** Vin/Vinyl-veksler + `data-collection` i `App.jsx` (INTERIM-kommentert) —
Fase 5 erstatter med delt skall + `useNav`. `--accent`/`--accent-soft` innført som gull-alias
(vinyl-aksent kommer i Fase 7). `.wine-card`-regelen deler nå navn med `.item-card` fram til
Fase 5-omdøpingen. Verifisert i nettleser: CRUD, status-veksling, filter/søk, edit-prefill,
migrering urørt, vin-siden uten regresjon. Prod-bygg grønt. design-critique kjørt (funn:
disc-glyph-kontrast fikset, år-etikett kortet, form delt i kjerne/detaljer, chip-trykkmål
44 px, kort viser «bærer»-format først).

Fase 5 gjort: tre commits. (1) Mekanisk flytting av vin-filene til `src/wine/`
(`src/components/`, `src/hooks/`, `src/data/` borte; `FilterBar` → `WineFilterBar`;
`ExportImport` → `shared/components/`). (2) Mekanisk omdøping `.wine-card`/`.wine-name`
→ `.item-card`/`.item-name`. (3) Skallet: `src/shared/useNav.js` (History API, én
tilstand `{collection, tab, detailId, form}`, `pushState` per skjermbytte, `popstate`
leser tilbake — Android-tilbakeknapp popper detalj → skjema → fane). `App.jsx` er nå rent
skall: segment + kombinert tellelinje («N viner · M plater», aktiv side i aksentfarge) på
list/add, tre skjermer (`WineScreen`/`VinylScreen`/`SettingsScreen`), bunn-nav (Samling ·
Legg til · Innstillinger) skjult i detalj/skjema. `WineScreen` trukket ut av App (speiler
`VinylScreen`). `SettingsScreen` + generalisert `shared/components/ExportImport.jsx`:
**én** sikkerhetskopifil `{app, version:2, exportedAt, wines, records}`, leser v1 (naken
array / `{wines}`) som kun-vin. `useOnlineStatus` flyttet til `shared/`.
**Ekte bug funnet + fikset:** `pushState` lå inne i `setNav`-updateren → React StrictMode
dobbeltkjører updateren → duplikate history-entries, tilbakeknappen måtte trykkes to
ganger. Flyttet ut av updateren (ren funksjon), `navRef` holder synkron tilstand for
sammensatte kall. Verifisert i nettleser: hele back-stacken (edit→detalj→liste→annen
samling), eksport/import rundtur (v2 + v1), ingen vin-regresjon. Prod-bygg grønt.
Fase 6 herder eksportformatet (`shared/backup.js`: cover-materialisering, én
import-transaksjon, blob stykkevis).

Fase 6 gjort: `src/shared/backup.js` eier nå hele sikkerhetskopi-formatet — skriving,
v1/v2-lesing, sanering og import. **Skriving:** hver post `JSON.stringify`-es for seg og
bufferet foldes inn i Blob-en hver batch, så JS-heapen aldri holder hele fila (ADR-6s
kjente begrensning). **Cover:** eksport slår inn fullbildet fra `covers` og leser dem i
batcher på 20 — 45 plater ga 3 transaksjoner, ikke 45. Coverløse plater får ikke feltet.
**Import:** én transaksjon over `wines` + `records` + `covers` (verifisert ved å telle
`IDBDatabase.transaction`-kall: 1). Normalisering og miniatyr-utleding skjer før
transaksjonen åpnes, ellers auto-committer den. Overskriving uten cover sletter cover-raden,
så en importert post ikke arver fullbildet til den den erstattet. **Lesing:** v2 → begge
lister; naken array eller `{wines}` uten `version` → v1, kun viner (records i en v1-fil
ignoreres); `version` > 2 → avvist uten delvis import. Feilkoder (`invalid_json`,
`not_a_backup`, `future_version`, `empty`) styrer norsk melding i UI-et.
De gamle import-veiene er fjernet (`dbBulkPut`/`importWines`, `dbBulkPutRecords`/
`importRecords`) så det finnes én vei inn; `SettingsScreen` laster begge hooks på nytt
etter import, og `useRecordDB.refresh` tømmer cover-cachen siden importen skriver bak
hookens rygg. Verifisert i nettleser: 78 assertions grønne (harness i scratchpad, ikke i
repo) — versjonsgjenkjenning, fiendtlig input på begge typer, cover-splitting,
atomisitet, stykkevis skriving over flush-grensene (250 viner + 45 plater), full rundtur
eksport → tøm → import, og ekte v1-fil. Deretter hele UI-flyten i appen: import fra
filvelgeren, «2 viner · 2 plater» i tellelinja, miniatyr tegnet, fullbilde i `covers`,
og alle fire feilmeldingene. Prod-bygg grønt.

## Fast praksis (etablert Fase 0–6, gjelder resten)

- **Verifisering uten testrammeverk:** skriv en harness i prosjektroten
  (`harness-faseN.html` + `.js`), kjør den mot dev-serveren, flytt den til scratchpad og
  slett den fra repoet før commit. Aldri sjekk inn harnessen.
- **Skriv assertions mot invarianten, ikke mot en antatt rekkefølge.** To grønne
  testrunder i Fase 6 var egentlig feil test, ikke feil kode.
- **Async før transaksjon.** Alt som `await`-er (canvas, `makeThumbnail`, normalisering)
  må skje før en IndexedDB-transaksjon åpnes — en ledig transaksjon auto-committer.
  Dette er nå brutt tre steder på rad hvis man ikke passer på: `dbPutRecord`,
  `dbBulkPutRecords` (fjernet) og `importBackup`.
- **Én vei inn i basen per operasjon.** Fase 6 fjernet de parallelle import-veiene.
  Hvis en ny fase trenger å skrive mange poster, utvid `shared/backup.js` eller den
  eksisterende hook-en — ikke lag en ny bulk-funksjon ved siden av.
- Commit + push når fasen er ferdig, kryss av i «Fremdrift», flytt «Nåværende fase» og
  skriv et «Fase N gjort»-avsnitt med det som faktisk avvek fra planen.

## Per-fase kickoff-meldinger

Lim inn i ny chat etter å ha byttet modell.

**Fase 0:** `Les docs/PLAN.md. Kjør Fase 0 (rebrand Vinkjeller → Vin og vinyl). Sonnet, think. Ikke rør DB_NAME. Commit + push når ferdig, kryss av i PLAN.md.`

**Fase 1:** `Les docs/PLAN.md. Kjør Fase 1 (arkitektur-ADR for kombinert app). Opus, think hard. Bruk architecture-skill. Leveranse: docs/ARCHITECTURE.md + oppdatert datamodell i PLAN.md.`

**Fase 2:** `Les docs/PLAN.md + docs/ARCHITECTURE.md. Kjør Fase 2 (recordSchema.js + useRecordDB.js + sanitize.js). Opus, think hard.`

**Fase 3:** `Les docs/PLAN.md. Kjør Fase 3 (Discogs Worker-proxy + useDiscogs). Opus, ultrathink på proxy-sikkerhet. Discogs-token er Worker-secret, aldri i klient.`

**Fase 4:** `Les docs/PLAN.md + docs/ARCHITECTURE.md. Kjør Fase 4 (vinyl-UI). Sonnet, think. design-critique på slutten.`

**Fase 5:** `Les docs/PLAN.md. Kjør Fase 5 (kombinert navigasjon + delt skall). Sonnet, think.`

**Fase 6:** `Les docs/PLAN.md. Kjør Fase 6 (eksport/import v2, bakoverkompat v1). Opus, think.`

**Fase 7:** `Les docs/PLAN.md + docs/ICON_PHILOSOPHY.md. Kjør Fase 7 (tema + ikoner). Fable. theme-factory + canvas-design.`

**Fase 8:** `Les docs/PLAN.md. Kjør Fase 8 (polish, a11y, tekst). Sonnet. accessibility-review + ux-copy.`

**Fase 9:** `Les docs/PLAN.md. Kjør Fase 9 (sikkerhet). Opus, think hard. /sikkerhetsanalyse så /bugreview.`

**Fase 10:** `Les docs/PLAN.md. Kjør Fase 10 (test + prod-bundle). Sonnet. run-skill + Playwright i scratchpad.`

**Fase 11:** `Les docs/PLAN.md. Kjør Fase 11 (deploy-handoff + memory). Sonnet, low.`
