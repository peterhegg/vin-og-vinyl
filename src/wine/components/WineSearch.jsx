import { useState } from "react";
import { useVinmonopolet } from "../useVinmonopolet.js";
import { barcodeSupported } from "../../shared/useBarcode.js";
import BarcodeScanner from "../../shared/components/BarcodeScanner.jsx";

/** Search-first entry point: Vinmonopolet search, barcode lookup, or manual entry. */
export default function WineSearch({ onSelect, onManual }) {
  const { results, loading, error, search, lookupBarcode, clear } = useVinmonopolet();
  const [term, setTerm] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setNotFound(false);
    if (term.trim()) search(term.trim());
  };

  const handleBarcode = async (ean) => {
    setNotFound(false);
    const hits = await lookupBarcode(ean);
    if (!hits.length) setNotFound(true);
  };

  return (
    <div className="stack" style={{ gap: "var(--sp-3)" }}>
      <form onSubmit={submit} className="row">
        <input
          type="search"
          className="input"
          style={{ flex: 1, width: "auto" }}
          placeholder="Søk vinnavn…"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (!e.target.value) clear();
          }}
          aria-label="Søk etter vin på Vinmonopolet"
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
        {error?.code === "not_configured" && (
          <p className="error-text">
            Vinmonopolet-søk er ikke satt opp ennå. Bruk «Legg til manuelt» i stedet.
          </p>
        )}
        {error && error.code !== "not_configured" && (
          <p className="error-text">Fikk ikke kontakt med Vinmonopolet. Prøv igjen om litt, eller legg til manuelt.</p>
        )}
        {loading && <p className="hint">Søker…</p>}
        {notFound && (
          <p className="hint">Fant ingen vin med den strekkoden. Legg til manuelt.</p>
        )}
      </div>

      {results.length > 0 && (
        <>
          <p className="hint" style={{ margin: 0 }}>
            Velg en vin for å fylle inn navnet. Vinmonopolet gir bare navnet — produsent, pris, druer og
            resten fyller du inn selv, gjerne med produktsiden åpen ved siden av.
          </p>
          <ul className="plain-list">
            {results.map((r, i) => (
              <li key={r.vinmonopoletId ?? i}>
                <button type="button" className="result-item" onClick={() => onSelect(r)}>
                  <span className="item-name result-title">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="btn btn-ghost" onClick={onManual}>
        <span aria-hidden="true">+</span> Legg til manuelt
      </button>

      {scanning && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
