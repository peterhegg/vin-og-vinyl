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

Vinyl-oppslag går gjennom samme Worker-proxy. Discogs-token settes som Worker-secret (`wrangler secret put DISCOGS_TOKEN`) — aldri i klienten. Se `docs/PLAN.md` (Fase 3) for detaljer.

## Datamodell

- Én vin følger `src/data/wineSchema.js`: Vinmonopolet-felter, egne smaksnotater og lagerstyring (`quantity`, `cellarLocation`, `drinkFrom` / `drinkBy`).
- Én plate følger `src/data/recordSchema.js` (under utvikling).

## Eksport / import

Under Innstillinger kan du eksportere hele samlingen til én JSON-fil (`vin-og-vinyl-eksport-YYYY-MM-DD.json`) — bilder er inkludert som base64, så ingenting går tapt. Import validerer fila og fletter inn på `id` (nye rader legges til, eksisterende overskrives).

## Deploy

Push til `main` → GitHub Actions bygger og publiserer til GitHub Pages automatisk (`.github/workflows/deploy.yml`).
