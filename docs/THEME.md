# Tema: «Kjeller og grafitt»

Egendefinert tema (theme-factory, Fase 7). Én kjeller, to materialer: gull for vin,
grafitt + messing for vinyl. Kilden er `:root` i `src/styles/index.css`; dette dokumentet
forklarer valgene og kontrastgarantiene.

## Palett

| Token | Verdi | Rolle |
|---|---|---|
| `--bg` | `#1A0A0E` | Kjelleren. Sidebakgrunn for begge samlinger, uendret fra Vinkjeller. |
| `--burgundy` / `--burgundy-2` | `#2C1018` / `#3D1A22` | Vin-flater (kort, felt, segment). |
| `--gold` / `--gold-soft` | `#C9A84C` / `#9c823a` | Vin-aksent **og** appens merkevare: fokusring, bunn-nav, lenker i skallet. |
| `--graphite` / `--graphite-2` | `#22161E` / `#2C2228` | Vinyl-flater. Samme luminans som burgunder (0,010 / 0,018), men kjøligere og avmettet — plate-svart, ikke vin-rødt. |
| `--brass` / `--brass-soft` | `#C8955A` / `#9b6e3b` | Vinyl-aksent. Fargetone 32° mot gullets 44°: varmere og mer oransje, samme lysstyrke, så vekslingen leses som materialbytte, ikke som «feil gull». |
| `--ink` | `#141118` | Plate-svart. Hullet i disc-glyfen og bakgrunnen i app-ikonets plate. |

Tekst (`--text`, `--text-soft`), semantiske farger og typografi er felles og uendret.

## Samlingsbytte (ADR-8)

`.app-shell[data-collection="vinyl"]` overstyrer seks tokens i én regelblokk:
`--surface`, `--surface-2`, `--accent`, `--accent-soft`, `--accent-tint`, `--accent-gradient`.
Alt annet er strukturelt og bruker `--gold` direkte. Innstillinger er delt og får ingen
`data-collection` → alltid gull.

Bruker `--accent`-familien: primærknapp og aktivt segment (`--accent-gradient` +
`--on-accent`), tags, aktive chips, tellelinjas aktive tall, `stats-line`, lenker inne i
skjermene, notatblokk, tomtilstand-glyf, disc-glyfen i `RatingInput`.

## Kontrast (WCAG 2.1)

| Par | Ratio | Krav |
|---|---|---|
| messing på `--bg` / grafitt / grafitt-2 | 7,2 / 6,6 / 5,8 | 4,5 (tag-tekst 11 px) ✓ |
| `--on-accent` `#241009` på messing | 6,9 | 4,5 ✓ |
| `--text-soft` på grafitt / grafitt-2 | 5,8 / 5,1 | 4,5 ✓ |
| `--rating-empty` på grafitt-2 | 3,5 | 3,0 (grafikk) ✓ |
| aktiv disc (messing) vs inaktiv ring | 1,7 | ingen — skilles på form (fylt vs ring), som i Fase 4 |

Luminansmatchingen er poenget: skift av samling endrer farge, aldri lesbarhet.

## Typografi

Uendret: Cormorant Garamond (display, kursiv for navn) + IBM Plex Sans (UI).
