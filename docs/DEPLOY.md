# Deploy — sjekkliste for å få «Vin og vinyl» live

Koden er ferdig og pushet. Det som gjenstår er syv steg som krever *dine* kontoer og
nøkler — de kan ikke gjøres av en agent, og appen er med vilje ikke live før du har
gjort dem.

Rekkefølgen betyr noe: steg 3–5 må være gjort før steg 7, ellers bygger workflowen
mot feil proxy.

Appen ender opp på **https://peterhegg.github.io/vin-og-vinyl/**

---

## Hva som virker uten hvert steg

Det er ikke alt-eller-ingenting. Hopper du over et steg, mister du bare det steget:

| Uten dette | Konsekvens |
|---|---|
| `DISCOGS_TOKEN` | Discogs-rutene svarer `503`. Vinyl kan fortsatt legges inn manuelt; vin-søk virker som før. |
| `VINMONOPOLET_KEY` | Vinsøk virker ikke. Vin kan legges inn manuelt; vinyl er upåvirket. |
| Worker i det hele tatt | Begge søk faller ut. Alt annet — registrering, filtrering, sikkerhetskopi, offline — virker. |
| Repo-secrets | **Bygget feiler med vilje.** Ingenting publiseres. |

Dataene dine ligger uansett bare på enheten, i IndexedDB.

---

## 1. Repo-navnet

Gjort allerede (`gh repo rename vin-og-vinyl`, remote oppdatert, GitHub sin redirect
fra det gamle navnet er aktiv). Sjekk at det stemmer:

```bash
git remote -v
```

Skal peke på `github.com/peterhegg/vin-og-vinyl`. Gjør den ikke det:

```bash
gh repo rename vin-og-vinyl
git remote set-url origin https://github.com/peterhegg/vin-og-vinyl.git
```

## 2. Discogs-token

1. Logg inn på https://www.discogs.com/settings/developers
2. Under *Personal access token* → **Generate new token**
3. Kopier verdien. Den vises bare én gang.

Tokenet er personlig og gir Discogs 60 forespørsler i minuttet. Det skal **aldri** inn i
dette repoet eller i en `.env` — det bor kun i Workeren.

## 3. Legg hemmelighetene i Workeren

Fra prosjektmappa:

```bash
wrangler secret put DISCOGS_TOKEN
```

Lim inn tokenet fra steg 2 når den spør.

Har du ikke satt de to andre fra før (fra Vinkjeller-tida), gjør dem nå også:

```bash
wrangler secret put VINMONOPOLET_KEY
wrangler secret put CLIENT_TOKEN
```

- `VINMONOPOLET_KEY` er `Ocp-Apim-Subscription-Key` fra https://developer.vinmonopolet.no
- `CLIENT_TOKEN` er en verdi du finner på selv. Lag den med `openssl rand -hex 32`, og
  **ta vare på den** — nøyaktig samme verdi skal inn som `VITE_APP_TOKEN` i steg 5.

Sjekk hva som ligger der:

```bash
wrangler secret list
```

## 4. Deploy Workeren under det nye navnet

```bash
wrangler deploy
```

`wrangler.toml` sier allerede `name = "vin-og-vinyl-proxy"`, så den publiseres på

```
https://vin-og-vinyl-proxy.<ditt-workers-subdomene>.workers.dev
```

Noter URL-en `wrangler` skriver ut — den trengs i neste steg.

**Den gamle `vinkjeller-proxy`-Workeren blir liggende.** Den er ikke i veien, men når du
har bekreftet at den nye virker, kan du slette den for å slippe å ha to sett hemmeligheter
i live: `wrangler delete --name vinkjeller-proxy`.

Rask røyktest — skal svare `401 unauthorized` (det betyr at Workeren lever og at
token-porten virker):

```bash
curl -i https://vin-og-vinyl-proxy.<ditt-subdomene>.workers.dev/discogs/search?q=test
```

Og med token — skal gi JSON med `results`:

```bash
curl -s -H "Authorization: Bearer <CLIENT_TOKEN>" \
  "https://vin-og-vinyl-proxy.<ditt-subdomene>.workers.dev/discogs/search?q=talk+talk" | head -c 400
```

## 5. Repo-secrets på GitHub

Settings → Secrets and variables → **Actions**. To stykker:

| Navn | Verdi |
|---|---|
| `VITE_PROXY_URL` | Worker-URL-en fra steg 4, uten skråstrek på slutten |
| `VITE_APP_TOKEN` | Nøyaktig samme verdi som `CLIENT_TOKEN` i steg 3 |

Eller fra terminalen:

```bash
gh secret set VITE_PROXY_URL
gh secret set VITE_APP_TOKEN
```

**`VITE_PROXY_URL` må være riktig.** Den skrives inn i appens `connect-src`-CSP ved
bygging. Er den feil, blokkerer nettleseren alle proxy-kall — og eneste sporet er en
CSP-melding i konsollen. Mangler den helt, feiler bygget med vilje i stedet.

## 6. Rate limiting (valgfritt, men anbefalt)

Uten dette hoppes rate-limiting over. Med det får hver IP 60 API-kall og 30 cover-kall i
minuttet, og avviste innlogginger sin egen bøtte på 20:

```bash
wrangler kv namespace create RATE_LIMIT_KV
```

Lim `id`-en inn i `wrangler.toml` og fjern kommentartegnene på `[[kv_namespaces]]`-blokka,
så `wrangler deploy` på nytt.

## 7. GitHub Pages og første kjøring

1. Settings → **Pages** → *Source* skal stå på **GitHub Actions** (ikke «Deploy from a
   branch»). Den innstillingen overlevde omdøpingen, men sjekk den.
2. Actions-fanen → workflowen **«Deploy til GitHub Pages»** → **Re-run all jobs** på
   siste kjøring. (Eller bare push en commit til `main` — den trigger på push.)
3. Kjøringen skal være grønn. Blir den rød på steget «Validate required secrets», mangler
   en av secretsene fra steg 5.

Åpne https://peterhegg.github.io/vin-og-vinyl/ når kjøringen er ferdig.

---

## Sjekk at det virker

- [ ] Sida laster og viser Vin/Vinyl-segmentet
- [ ] **Vin → Legg til → søk** på f.eks. «barolo» gir treff (bekrefter `VINMONOPOLET_KEY`)
- [ ] **Vinyl → Legg til → søk** på f.eks. «talk talk» gir treff med cover (bekrefter `DISCOGS_TOKEN`)
- [ ] Ingen røde CSP-meldinger i nettleserkonsollen (bekrefter `VITE_PROXY_URL`)
- [ ] Legg inn én plate, gå til **Innstillinger → Last ned sikkerhetskopi**, sjekk at fila
      inneholder `"version": 2` og både `wines` og `records`
- [ ] På Android: «Legg til på startskjermen» i Chrome-menyen — appen skal installere seg
      med det nye ikonet og åpne uten nettleserramme
- [ ] Slå på flymodus og åpne appen — samlingen skal fortsatt vises, med
      «Uten nett nå»-banneret øverst

## Hvis noe ryker

| Symptom | Sannsynlig årsak |
|---|---|
| Bygget feiler på «Validate required secrets» | Repo-secret mangler (steg 5) |
| Søk gjør ingenting, CSP-melding i konsollen | `VITE_PROXY_URL` ≠ Worker-URL-en |
| «Discogs-søk er ikke satt opp ennå» | `DISCOGS_TOKEN` ikke satt i Workeren (steg 3) |
| Alle søk gir 401 | `VITE_APP_TOKEN` ≠ `CLIENT_TOKEN` |
| Sida er blank / 404 | Pages-kilden står på «branch» i stedet for «GitHub Actions» |
| Gammel versjon vises etter deploy | Service workeren har cachet den. Last hardt (Ctrl/Cmd+Shift+R) eller lukk og åpne PWA-en |

Feilkodene Workeren svarer med er dokumentert i `README.md` under *Discogs-API*, og
sikkerhetsvalgene bak dem i `BUG-REPORT.md`.
