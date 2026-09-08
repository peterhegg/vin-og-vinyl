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
- Utvid `cloudflare-worker.js`: ruter for `GET /discogs/search?q=` og `GET /discogs/release/:id` og `GET /discogs/barcode?ean=`. Discogs-token som Worker-secret `DISCOGS_TOKEN` (aldri i klient). Behold `CLIENT_TOKEN`-gate + valgfri KV-rate-limit. Legg på `User-Agent` (Discogs krever det). Håndter 429 fra Discogs (60 req/min).
- Cover: Worker henter release-bilde og returnerer som base64 (Discogs-bilde-URL-er trenger token/hotlink-vern) — klienten lagrer base64.
- `src/hooks/useDiscogs.js`: `search(query)`, `lookupByBarcode(ean)`, `getRelease(id)`, `mapReleaseToRecord()`.
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

### Fase 8 — Polish
- **Modell:** Sonnet · **Effort:** medium · **Egen chat:** nei
- **Skills:** `accessibility-review`, `ux-copy`
- Tomtilstander, mikrotekst, 48px trykkmål, offline-banner-tekst, tastatur/skjermleser.

### Fase 9 — Sikkerhetsgjennomgang
- **Modell:** Opus · **Effort:** think hard · **Egen chat:** ja
- **Skills:** `/sikkerhetsanalyse` (auto), deretter `/bugreview`
- Fokus: Discogs-proxy (SSRF, token-lekkasje, CORS, rate-limit), import-sanering på nye felt, XSS i nye felt, CSP.

### Fase 10 — Test + verifiser prod-bundle
- **Modell:** Sonnet · **Effort:** medium · **Egen chat:** nei (m/ Fase 9)
- **Skills:** `run`
- Playwright i scratchpad (ikke i repo, som sist). Bygg prod-bundle, verifiser vin + vinyl-flyt, offline, PWA-install.

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
- [ ] Fase 2 — Vinyl-datamodell + DB
- [ ] Fase 3 — Discogs-proxy
- [ ] Fase 4 — Vinyl-UI
- [ ] Fase 5 — Kombinert navigasjon
- [ ] Fase 6 — Eksport/import v2
- [ ] Fase 7 — Tema + ikoner
- [ ] Fase 8 — Polish
- [ ] Fase 9 — Sikkerhet
- [ ] Fase 10 — Test
- [ ] Fase 11 — Deploy-handoff

**Nåværende fase:** Fase 2 — Vinyl-datamodell + IndexedDB-lag. Opus, think hard.

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
