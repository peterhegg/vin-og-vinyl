# Bug-rapport — Vin og vinyl

Gjennomgang før deploy. React 18 + Vite + PWA (Workbox injectManifest) +
IndexedDB, Cloudflare Worker-proxy, GitHub Pages. Ingen kritiske eller høye
funn — kjerneflyt, eksport/import og sikkerhet er testet med Playwright i
tidligere faser. Funnene under er kodekvalitet / små logikk-smell.

---

### [React] `getWine` har blandet returtype og er ubrukt

**Fil:** `src/hooks/useWineDB.js` (linje 200–203)
**Alvorlighetsgrad:** Lav
**Beskrivelse:** `getWine` returnerer enten et synkront objekt (treff i cache)
eller et `Promise` (fallback til `dbGetWine`). En kaller kan ikke vite hvilken.
Appen bruker den ikke (den leser `wines.find(...)` direkte), så det er også
død overflate som kan forvirre.
**Forslag til fix:** Enten fjern `getWine` fra hooken, eller gjør den entydig
async: `const getWine = useCallback(async (id) => wines.find(w => w.id === id) ?? dbGetWine(id), [wines]);`

---

### [Logikk] `tastedAt` nullstilles ikke ved bytte smakt → ønske

**Fil:** `src/components/WineForm.jsx` (submit, linje 15–22)
**Alvorlighetsgrad:** Lav
**Beskrivelse:** Settes når status er «smakt», men beholdes hvis brukeren
senere endrer en smakt vin til «ønske». Feltet vises ikke i UI, så effekten er
kun inkonsistente data i eksport-JSON.
**Forslag til fix:** I submit: `next.tastedAt = next.status === WINE_STATUS.TASTED ? (next.tastedAt ?? new Date().toISOString()) : null;`

---

### [Kode] Dobbel normalisering ved import

**Fil:** `src/components/ExportImport.jsx:43` + `src/hooks/useWineDB.js:82`
**Alvorlighetsgrad:** Lav
**Beskrivelse:** `ExportImport` kaller `normalizeWine` for å telle nye/oppdaterte,
og `dbBulkPut` normaliserer på nytt. Idempotent, så ikke skadelig — bare dobbelt
arbeid.
**Forslag til fix:** La `ExportImport` sende allerede normaliserte objekter, og la
`dbBulkPut` anta gyldige rader (eller motsatt). Ikke kritisk.

---

### [Kode] Ubrukt eksport `WINE_KEYS`

**Fil:** `src/data/wineSchema.js:64`
**Alvorlighetsgrad:** Lav
**Beskrivelse:** Eksportert, aldri brukt. Død kode.
**Forslag til fix:** Fjern, eller ta i bruk til å white-liste felt ved import.

---

### [Kode] Ubrukt async `queryWines`

**Fil:** `src/hooks/useWineDB.js:156`
**Alvorlighetsgrad:** Lav
**Beskrivelse:** Del av spec-ens API-flate, men appen filtrerer klient-side via
`filterAndSortWines`. Ufarlig, men død i praksis.
**Forslag til fix:** Behold som dokumentert API, eller fjern for å redusere flate.

---

### [PWA] `autoUpdate` + `skipWaiting` kan bytte service worker midt i økt

**Fil:** `vite.config.js:12` + `src/sw.js:5`
**Alvorlighetsgrad:** Lav
**Beskrivelse:** Ny SW aktiveres umiddelbart. For en enkel offline-app er dette
greit, men kan i teorien laste inn ny kode midt i en handling.
**Forslag til fix:** Akseptabelt som det er. Vurder `prompt`-basert oppdatering
kun hvis det oppstår problemer.

---

## Oppsummering

| Alvorlighetsgrad | Antall |
|------------------|--------|
| Kritisk | 0 |
| Høy | 0 |
| Medium | 0 |
| Lav | 6 |

**Tre å ta først:** (1) `getWine` returtype, (2) `tastedAt`-logikk,
(3) dobbel normalisering. Alle er trygge lavrisiko-opprydninger.
