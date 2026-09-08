# Bug- og sikkerhetsrapport — Vin og vinyl

Fase 9, 2026-09-08/09. Erstatter den forrige rapporten (som gjaldt kodebasen før
vinyl-modulen kom til; alle funn der er enten fikset eller ikke lenger relevante
etter flyttingen til `src/wine/` og `src/shared/`).

## Kartlegging

| | |
|---|---|
| **Type** | Installerbar PWA, én React 18-SPA, ingen router-bibliotek |
| **Bygg** | Vite 8 + `vite-plugin-pwa` (Workbox `injectManifest`), base `/vin-og-vinyl/` |
| **Data** | Alt lokalt i IndexedDB (`vinkjeller-db` v2: `wines`, `records`, `covers`). Ingen konto, ingen server-side lagring. `localStorage` brukes ikke i det hele tatt |
| **Backend** | Én Cloudflare Worker som proxy mot Vinmonopolet og Discogs. Oppstrøms-nøkler er Worker-secrets |
| **Klient↔proxy** | `Authorization: Bearer <VITE_APP_TOKEN>`, delt token som bakes inn i bundelen — en kvotesperre, ikke autentisering (bevisst, dokumentert) |
| **Hosting/CI** | GitHub Pages via GitHub Actions; workflowen avbryter hvis `VITE_PROXY_URL`/`VITE_APP_TOKEN` mangler |
| **Sikkerhetsoppsett fra før** | CSP i `<meta>`, CORS-allowlist og KV-basert rate limiting i Workeren, sanering av alle eksterne URL-er og bilder |

**Vektlegging.** Angrepsflaten er liten og godt avgrenset: ingen innlogging, ingen
flerbrukerdata, ingen AI-integrasjon, ingen betaling. Seksjonene om autentisering,
prompt injection og skylagring er derfor utelatt. Tyngden er lagt på de to stedene
utenfra-data faktisk kommer inn — **importfila** (`shared/backup.js`, eneste vei inn
i basen) og **Discogs-proxyen** — og på hva som skjer med dataene etterpå.

Alle funn under er verifisert i nettleser eller mot en mocket Worker, ikke bare lest
ut av koden. Alt er fikset i samme fase; «Status: fikset» viser hvor.

---

## Sikkerhetsfunn

### [KRITISK] Importfil kunne sette appen permanent ut av spill

**Fil:** `src/vinyl/recordSchema.js` (linje 88–131), `src/wine/wineSchema.js` (linje 26–66)
**Status:** ✅ fikset

`createRecord`/`createWine` slapp gjennom hva som helst for de fleste tekstfeltene
(`partial.label ?? ""`). `normalizeRecord` typesjekket bare et utvalg — `label`,
`myNotes`, `storageLocation`, `country`, `addedAt`, `id` og de fleste vinfeltene sto
igjen. En sikkerhetskopi med `"label": {"a": 1}` ble derfor lagret som et objekt.

React kaster på et objekt som barn. Raden ligger i IndexedDB, så kastet gjentar seg
ved hver render — og uten en feilgrense river et kast på rot-nivå hele treet ned.
Resultat: **hvit skjerm som overlever reload**, og som brukeren bare kommer ut av ved
å slette nettstedsdata (altså hele samlingen). Verifisert i nettleser: en slik rad
tok ned appen fullstendig.

```js
// før — objektet gikk rett gjennom
label: partial.label ?? "",
```

**Fikset ved** å flytte all felt-tvang inn i `createRecord`/`createWine`, som er den
*eneste* porten alle skriveveier går gjennom (`dbPutRecord` kaller den direkte, så en
sjekk kun i `normalizeRecord` ville fortsatt vært omgåelig). Nye delte hjelpere i
`shared/sanitize.js`: `safeText`, `safeTextOrNull`, `safeNumber`, `safeCount`,
`safeId`, `safeIsoDate`. `normalizeRecord`/`normalizeWine` er nå bare regelen om at
en import ikke skal lage tomme rader.

```js
// etter
label: safeText(partial.label, 200),
```

I tillegg: `src/shared/components/ErrorBoundary.jsx` rundt `<App/>` som siste skanse,
med en norsk gjenopprettingsskjerm i stedet for blank side. Verifisert ved å skrive en
rå, uvalidert rad forbi skjemaet rett i IndexedDB — appen viser nå «Noe gikk galt» med
«Last inn på nytt» i stedet for å forsvinne.

---

### [HØY] Importen var ikke atomisk likevel — en ugyldig rad ga halv-import

**Fil:** `src/shared/backup.js` (linje 223–231)
**Status:** ✅ fikset

Fase 6 la importen i én transaksjon nettopp for at en korrupt fil ikke skal etterlate
halve samlingen. Men `IDBObjectStore.put()` kaster **synkront** på en verdi den ikke kan
lagre (`DataError` på ugyldig nøkkel, `DataCloneError` på en verdi som ikke kan
struktur-klones). Kastet forplantet seg ut av `importBackup` med skrivinger allerede
lagt i kø — og de køede skrivingene committer likevel, fordi transaksjonen aldri ble
avbrutt.

Målt i nettleser, tre puts der nummer to kaster:

```
{ throwName: "DataCloneError", committedWithoutAbort: ["a"] }
```

Rad `a` ble altså liggende. Garantien «ingenting ble endret» i feilmeldingen i
Innstillinger var ikke sann.

**Fikset ved** å legge kø-løkka i `try`/`catch` med `tx.abort()` før kastet slippes
videre. Verifisert med en midlertidig wrapping av `IDBObjectStore.prototype.put`:
etter fiksen er antall rader uendret.

---

### [MIDDELS] Ingen størrelsesgrense på importfil

**Fil:** `src/shared/backup.js` (`readBackupFile`)
**Status:** ✅ fikset

`file.text()` dekoder hele fila til én JS-streng og `JSON.parse` bygger en kopi til.
Flere hundre MB dreper fana på telefon uten et ord. Nå avvises alt over 64 MB
(`MAX_BACKUP_BYTES`) før lesing, med egen feilkode `too_large` og norsk melding i
Innstillinger. En ekte sikkerhetskopi av en stor hylle med cover er noen titalls MB.

---

### [MIDDELS] Uautentiserte kall gikk utenom rate-limiten

**Fil:** `cloudflare-worker.js` (token-sjekken i `fetch`)
**Status:** ✅ fikset

Token-sjekken returnerte 401 **før** `overRateLimit` ble konsultert. Hvem som helst som
kjenner Worker-URL-en kunne dermed brenne kontoens forespørselskvote gratis, i det
uendelige. Ny `auth`-bøtte (20/min per IP) belastes på avviste kall. Verifisert mot
mocket oppstrøm: 25 kall med feil token gir 429, og en autentisert forespørsel belaster
fortsatt bare `api`-bøtta.

---

### [MIDDELS] Cover-taket gjaldt bare når oppstrøm oppga `Content-Length`

**Fil:** `cloudflare-worker.js` (`fetchCover`)
**Status:** ✅ fikset

`MAX_IMAGE_BYTES` ble bare sjekket mot den *oppgitte* lengden. Et chunked svar uten
`Content-Length` strømmet ubegrenset videre til klienten. Workeren buffer ingenting, så
det var ikke en fare for Workeren selv — men klienten lastet ned alt før `proxyBlob`
rakk å avvise det. Nå går strømmen gjennom en `TransformStream` som kutter over 5 MB.
Verifisert med et mocket 10 MB chunked bildesvar: strømmen feiler, og aldri mer enn
5 MB slipper gjennom.

---

### [MIDDELS] CSP-en falt stille tilbake til `'self'` hvis proxy-URL-en manglet

**Fil:** `index.html`, `vite.config.js`
**Status:** ✅ fikset

`connect-src 'self' %VITE_PROXY_URL%` erstattes av Vite bare når variabelen finnes.
Uten den blir plassholderen stående, og en ugyldig kilde i CSP droppes uten feil — så
bundelen får `connect-src 'self'` og *alle* proxy-kall blokkeres, uten spor annet enn i
nettleserkonsollen. `dist/` på maskinen inneholdt nøyaktig dette. CI validerer riktignok
secreten, så prod var aldri rammet. `vite.config.js` avbryter nå produksjonsbygget hvis
`VITE_PROXY_URL` mangler.

---

### [LAV] `safeExternalUrl` gjorde søppel om til lenker til egen origin

**Fil:** `src/shared/sanitize.js`
**Status:** ✅ fikset

`new URL(value, window.location.origin)` gjorde at `"relative-path"` ble til
`https://peterhegg.github.io/relative-path` og `"//evil.com/x"` til `https://evil.com/x`
— begge http(s), begge godkjent. `javascript:`/`data:` ble korrekt avvist, så det var
aldri XSS, men en importfil kunne plante klikkbare lenker som utga seg for å være
Discogs-lenker. URL-en parses nå uten base (absolutt eller ingenting), og
`user:pass@`-URL-er avvises.

---

### [LAV] CSP manglet `base-uri` og `form-action`

**Fil:** `index.html`
**Status:** ✅ fikset

Ingen av de to arver fra `default-src`, så `default-src 'none'` dekket dem ikke. Begge
satt til `'none'`. `frame-ancestors` er samtidig **fjernet**: den ignoreres i en
meta-CSP (den virker bare som ekte header, som GitHub Pages ikke kan sende), og Fase 10
viste at den kostet en konsolladvarsel ved hver eneste sidelast uten å gi noe tilbake.
Appen har verken sesjon eller server-side handling som er verdt å ramme inn, så
restrisikoen er akseptert og dokumentert i en kommentar i fila.

---

### [LAV] 5 høyalvorlige CVE-er i byggavhengigheter

`fast-uri`, `nanoid`, `postcss` (alle transitive, alle kun `devDependencies`). Ingen
runtime-avhengigheter var berørt (`npm audit --omit=dev`: 0). Løst med `npm audit fix`;
`npm audit` er nå ren.

---

### Verifisert som **ikke** sårbart

- **Prototypeforurensning.** `JSON.parse` lager `__proto__` som en *egen* nøkkel
  (utløser ikke setteren), og `createRecord`/`createWine` leser kun navngitte felt, så
  nøkkelen kopieres aldri videre. Testet med `__proto__` og `constructor.prototype` i
  en ekte importfil: `Object.prototype` er urørt, og ingen slik nøkkel havner i basen.
- **SSRF i Discogs-proxyen.** Klienten oppgir aldri en URL — bare en release-id som
  rutemønsteret begrenser til siffer. Cover-URL-en kommer fra Discogs' eget svar, og
  verten sjekkes mot allowlist, skjemaet må være https, redirects avvises. Testet at et
  svar som peker på `evil.example` avvises uten at forespørselen sendes.
- **Token-lekkasje.** `DISCOGS_TOKEN` sendes kun til `api.discogs.com` — aldri til CDN-en,
  aldri til klienten, aldri i en feilkropp. Verifisert ved å logge alle utgående kall.
- **CORS.** Ukjent origin får ikke `Access-Control-Allow-Origin` i det hele tatt.
- **XSS via bilder.** `safeImageDataUrl` avviser `data:image/svg+xml` (SVG er det eneste
  bildeformatet som kan bære skript).
- **Kamera.** `useBarcode` stopper alle tracks ved unmount og ved feil.
- **Hemmeligheter i repoet.** Kun `.env.example` er sporet; `.env` og `dist/` er ignorert.
  `VITE_APP_TOKEN` ligger i bundelen — bevisst og dokumentert.

---

## Bug-funn (ikke sikkerhet)

### [React] Full-oppløste cover ble skjøvet inn i history-state

**Fil:** `src/shared/useNav.js`, `src/vinyl/VinylScreen.jsx` (linje 36–39)
**Alvorlighetsgrad:** Høy
**Status:** ✅ fikset

`openForm({ initial: record, cover })` la hele `nav` inn i en `history.pushState`-oppføring
— inkludert coveret på ~64 kB (målt på et ekte 800 px-omslag). Hver eneste
skjema-åpning kopierte altså bildet inn i sesjonshistorikken, og oppføringene
akkumuleres. Firefox har et tak på samlet history-state og **kaster** fra `pushState`
når det nås; kastet skjer inne i en React-hendelse og ville nå truffet feilgrensa —
appen ville krasjet i navigasjonen etter mange redigeringer i én økt.

**Fikset ved** at bildet holdes i en modul-lokal `Map` utenfor historikken, og
oppføringen bærer bare et token (de fire siste beholdes). Skjermene leser fortsatt
`nav.form.cover` — bildet settes tilbake på vei ut av hooken. Etter en reload løser
ikke tokenet lenger opp: skjemaet åpner da uten forhåndsvisning, og fordi coveret aldri
markeres som «rørt» blir det lagrede bildet stående urørt. Ingenting går tapt.

Målt før/etter på samme redigering: `JSON.stringify(history.state).length` gikk fra
~72 000 til 8 271 tegn, og skjemaet viser fortsatt coveret.

---

### [React] Strekkodeskanneren re-renderte 6 ganger i sekundet uten grunn

**Fil:** `src/shared/useBarcode.js`
**Alvorlighetsgrad:** Medium
**Status:** ✅ fikset

Fase 8 fjernet debug-linja fra UI-et, men `debug`-staten ble stående — og `setDebug`
kalles i `tick`, som kjører ~6 ganger i sekundet under skanning. Ingen konsument leste
`debug` lenger, så hele overlayet ble re-rendret seks ganger i sekundet for ingenting,
midt i den mest ressurskrevende operasjonen appen har (kamera + kanvas + dekoding). Hele
`debug`-maskineriet er fjernet.

---

### [React] `PhotoCapture` svelget feil uten et ord til brukeren

**Fil:** `src/shared/components/PhotoCapture.jsx`
**Alvorlighetsgrad:** Medium
**Status:** ✅ fikset

`catch { /* ignore — user can retry */ }`: en fil nettleseren ikke kan dekode, eller et
bilde for stort for et canvas, ga en knapp som stille ikke gjorde noe. Nå vises
«Klarte ikke å lese bildet. Prøv et annet, eller ta et nytt.»

---

### [Kodekvalitet] Død gren i `VinylScreen.save`

**Fil:** `src/vinyl/VinylScreen.jsx` (linje 30–34)
**Alvorlighetsgrad:** Lav
**Status:** åpen (bevisst)

`addRecord` og `updateRecord` er samme funksjon (`saveRecord` er upsert), så
`if (next.id && records.some(...))` velger mellom to identiske kall. Beholdt fordi den
speiler `WineScreen.save`, der grenene faktisk er ulike funksjoner — å fjerne den her
gjør de to skjermene mindre like uten å vinne noe.

---

### [UX] «Avspillinger» kan ikke tømmes

**Fil:** `src/vinyl/components/RecordForm.jsx` (linje 342–350)
**Alvorlighetsgrad:** Lav
**Status:** åpen

`onChange` gjør en tom streng til `0` med én gang, så feltet kan ikke stå tomt mens man
skriver om tallet. Fiksen krever en egen streng-state for råverdien; ikke verdt en
endring i skjemaet nå.

---

### [UX] «Lagre» lander på «Legg til», ikke på lista

**Alvorlighetsgrad:** Lav
**Status:** åpen — kjent siden Fase 5

`save()` avslutter med `onBack()`, som popper skjema-oppføringen og lander på fanen den
ble åpnet fra. Fra «Legg til»-fanen betyr det at man ser søkeskjermen igjen i stedet for
den nye plata i lista. Å endre det er en nav-semantikk-endring, ikke en polish-endring.

---

## Oppsummering

| Alvorlighetsgrad | Antall | Fikset |
|---|---|---|
| Kritisk | 1 | 1 |
| Høy | 2 | 2 |
| Middels | 5 | 5 |
| Lav | 5 | 3 |
| **Sum** | **13** | **11** |

De tre viktigste, i rekkefølge — alle tre er lukket i denne fasen:

1. **Typeforvirring fra importfil → permanent hvit skjerm.** Eneste funnet som kunne
   koste brukeren hele samlingen.
2. **Importen var ikke atomisk.** Garantien i feilmeldingen stemte ikke med koden.
3. **Uautentiserte kall utenom rate-limiten.** Den eneste kostnadsveien en fremmed
   kunne utnytte.

### Systemiske mønstre

- **Validering lagt ett hakk for langt ut.** Både typeforvirringen og den manglende
  atomisiteten kom av at sjekken lå i `normalizeRecord` (importveien) mens
  `createRecord` (alle veier) var porten som faktisk teller. Regelen «én vei inn i basen
  per operasjon» fra Fase 6 har nå en makker: **valideringen hører hjemme i den porten,
  ikke i den ene kalleren.**
- **Grenser håndhevet på det oppstrøms *påstår*, ikke på det som faktisk kommer.**
  Cover-taket stolte på `Content-Length`; importgrensa fantes ikke. Samme feilform.
- **Sikkerhetskontroller uten fallback når konfigurasjonen mangler.** CSP-plassholderen
  degraderte stille til noe strengere som brøt appen. Nå feiler bygget i stedet.
- **Kode som overlever formålet sitt.** `debug`-staten i `useBarcode` overlevde UI-et
  den fantes for. Verdt et blikk når en fase fjerner noe synlig.
