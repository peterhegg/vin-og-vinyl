# Vin og vinyl

Personlig samlings-PWA for **vin og vinyl** på ett sted. Alt lagres lokalt på enheten i IndexedDB — ingen konto, ingen server.

- **Vin:** søk opp viner fra Vinmonopolet (eller skann strekkode / legg inn manuelt), gi dine egne korkpoeng og smaksnotater, hold styr på lageret ditt og ønskelista.
- **Vinyl:** registrer plater du eier og plater på ønskelista, med data fra Discogs (artist, album, år, trykk, plateselskap, katalognr, format), tilstands­grading og egne notater.

> Status: vin-delen er ferdig. Vinyl-delen er under utvikling — se `docs/PLAN.md` for faseplan.

## Stack

- React + Vite
- PWA (offline app-shell via `vite-plugin-pwa`)
- IndexedDB for all lagring
- GitHub Pages for hosting (base-URL `/vin-og-vinyl/`)
- Cloudflare Worker som proxy mot Vinmonopolet- og Discogs-API-ene

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne http://localhost:5173/vin-og-vinyl/

## Vinmonopolet-API og proxy

Vinmonopolets produkt-API krever en abonnementsnøkkel (`Ocp-Apim-Subscription-Key`) og tillater ikke direkte kall fra nettleseren (CORS). Derfor går alle API-kall gjennom en **Cloudflare Worker** som holder nøkkelen skjult og legger på riktige CORS-headere.

### 1. Skaff gratis API-nøkkel

1. Gå til https://developer.vinmonopolet.no
2. Opprett bruker og logg inn
3. Abonner på produkt-API-et («Vinmonopolet API»)
4. Kopier `Ocp-Apim-Subscription-Key`

### 2. Sett opp proxy

Nøkkelen legges **aldri** i `.env` i dette prosjektet — den bor kun i Workeren:

```bash
# i proxy-mappa (egen Worker)
wrangler secret put VINMONOPOLET_KEY   # lim inn API-nøkkelen
wrangler secret put CLIENT_TOKEN       # samme verdi som VITE_APP_TOKEN under
wrangler deploy
```

Workeren videresender til `https://apis.vinmonopolet.no/products/v0/details-normal` og krever at klienten sender riktig `CLIENT_TOKEN`.

### 3. Klient-miljø

Kopier `.env.example` til `.env` og fyll inn:

```
VITE_PROXY_URL=https://vin-og-vinyl-proxy.DITTBRUKERNAVN.workers.dev
VITE_APP_TOKEN=<samme token som CLIENT_TOKEN i Workeren>
```

`.env` er git-ignorert. I GitHub Actions settes `VITE_PROXY_URL` og `VITE_APP_TOKEN` som repository secrets.

## Discogs-API

Vinyl-oppslag går gjennom **samme** Worker-proxy som vin. Ingen ny variabel i klienten.

### 1. Skaff token

1. Logg inn på https://www.discogs.com/settings/developers
2. «Generate new token» under *Personal access token*
3. Kopier verdien

### 2. Legg den i Workeren

```bash
wrangler secret put DISCOGS_TOKEN
wrangler deploy
```

Uten secreten svarer Discogs-rutene `503 discogs_not_configured`, mens vin-søket fortsetter å virke.

### Ruter

| Rute | Gir |
|------|-----|
| `GET /discogs/search?q=` | `{ results: [...] }` — inntil 25 treff |
| `GET /discogs/barcode?ean=` | samme form, oppslag på strekkode |
| `GET /discogs/release/<id>` | én utgivelse, trimmet til faste felt |
| `GET /discogs/cover/<id>` | coverbildet som bytes |

### Hvorfor det er bygget slik

- **Klienten sender aldri en URL.** Den sender en release-id, og Workeren bygger hver
  oppstrøms-URL selv av validerte siffer. Det finnes ingen kodesti som henter en adresse
  klienten har bestemt, så proxyen kan ikke brukes som åpent relé.
- **Coverbildet** hentes fra URL-en *Discogs selv* returnerte, og først etter at verten er
  sjekket mot en allowlist, protokollen er https og redirects er avvist.
- **`DISCOGS_TOKEN` går til `api.discogs.com` og ingen andre steder** — aldri til bilde-CDN-en,
  aldri tilbake til klienten, aldri i en feilmelding.
- **Svar trimmes** til en fast feltliste før de når klienten. En release krymper fra ~150 kB
  til ~1 kB, og ingenting uventet fra Discogs videreformidles.
- **Caching i Workeren** (søk 1 t, release 1 døgn, cover 30 dager) holder oss innenfor
  Discogs' grense på 60 kall i minuttet.

`CLIENT_TOKEN` kan hentes ut av klient-bundelen. Den er en kvotesperre mot direkte kall,
ikke ekte autentisering — derfor rate-limit i tillegg.

## Datamodell

- Én vin følger `src/data/wineSchema.js`: Vinmonopolet-felter, egne smaksnotater og lagerstyring (`quantity`, `cellarLocation`, `drinkFrom` / `drinkBy`).
- Én plate følger `src/vinyl/recordSchema.js`: Discogs-felter, Goldmine-tilstand for plate og cover, egne notater og kjøpsdata.
- Arkitekturen bak oppdelingen står i `docs/ARCHITECTURE.md`.

## Eksport / import

Under Innstillinger kan du eksportere hele samlingen til én JSON-fil (`vin-og-vinyl-eksport-YYYY-MM-DD.json`) — bilder er inkludert som base64, så ingenting går tapt. Import validerer fila og fletter inn på `id` (nye rader legges til, eksisterende overskrives).

## Deploy

Push til `main` → GitHub Actions bygger og publiserer til GitHub Pages automatisk (`.github/workflows/deploy.yml`).
