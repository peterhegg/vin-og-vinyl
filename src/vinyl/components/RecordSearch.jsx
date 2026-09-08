import { useState } from "react";
import { useDiscogs, mapReleaseToRecord, hitSummary, splitCombinedTitle } from "../useDiscogs.js";
import { barcodeSupported } from "../../shared/useBarcode.js";
import BarcodeScanner from "../../shared/components/BarcodeScanner.jsx";

const notConfigured = (err) =>
  err?.code === "not_configured" ||
  err?.reason === "discogs_not_configured" ||
  err?.code === 503;

/** Search-first entry point: Discogs search, barcode lookup, or manual entry. */
export default function RecordSearch({ onSelect, onManual }) {
  const { results, loading, error, search, lookupByBarcode, getRelease, getCover, clear } = useDiscogs();
  const [term, setTerm] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pickingId, setPickingId] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    setNotFound(false);
    if (term.trim()) search(term.trim());
  };

  const handleBarcode = async (ean) => {
    setNotFound(false);
    const hits = await lookupByBarcode(ean);
    if (!hits.length) setNotFound(true);
  };

  const choose = async (hit) => {
    if (pickingId != null) return;
    setPickingId(hit.id);
    try {
      const release = (await getRelease(hit.id)) || hit;
      const mapped = mapReleaseToRecord(release) || mapReleaseToRecord(hit);
      if (!mapped) return;
      const cover = hit.hasImage ? await getCover(hit.id).catch(() => null) : null;
      onSelect({ record: mapped, cover });
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div className="stack" style={{ gap: "var(--sp-3)" }}>
      <form onSubmit={submit} className="row">
        <input
          type="search"
          className="input"
          style={{ flex: 1, width: "auto" }}
          placeholder="Søk artist eller tittel…"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (!e.target.value) clear();
          }}
          aria-label="Søk etter plate på Discogs"
        />
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="Skann strekkode"
          onClick={() => setScanning(true)}
          disabled={!barcodeSupported}
          title={barcodeSupported ? "Skann strekkode" : "Ikke støttet i denne nettleseren"}
        >
          📷
        </button>
        <button type="submit" className="btn btn-primary" disabled={!term.trim()}>
          Søk
        </button>
      </form>

      <div aria-live="polite">
        {notConfigured(error) && (
          <p className="error-text">
            Discogs-søk er ikke satt opp ennå. Bruk «Legg til manuelt» i stedet.
          </p>
        )}
        {error && !notConfigured(error) && (
          <p className="error-text">
            Fikk ikke kontakt med Discogs. Prøv igjen om litt, eller legg til manuelt.
          </p>
        )}
        {loading && <p className="hint">Søker…</p>}
        {pickingId != null && <p className="hint">Henter utgivelsen…</p>}
        {notFound && <p className="hint">Fant ingen plate med den strekkoden. Legg til manuelt.</p>}
      </div>

      {results.length > 0 && (
        <ul className="plain-list">
          {results.map((hit, i) => {
            const { artist, title } = splitCombinedTitle(hit.title);
            return (
              <li key={hit.id ?? i}>
                <button
                  type="button"
                  className="result-item"
                  onClick={() => choose(hit)}
                  disabled={pickingId != null}
                >
                  <span className="item-name result-title">{artist || title}</span>
                  {artist && <span className="result-meta">{title}</span>}
                  {hitSummary(hit) && <span className="result-meta">{hitSummary(hit)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="btn btn-ghost" onClick={onManual}>
        + Legg til manuelt
      </button>

      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  );
}
