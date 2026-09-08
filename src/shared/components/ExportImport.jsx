import { useRef, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * One backup file for the whole app — both collections. Reads v1 files (a bare
 * array or `{ wines }`) as wine-only, and v2 files (`{ wines, records }`) as both.
 *
 * Fase 6 replaces the guts with `shared/backup.js`: cover materialisation,
 * a single import transaction, and a blob built piecewise (ADR-6). The file
 * shape written here is already the v2 shape so those files stay readable.
 */
export default function ExportImport({ wines, records, onImportWines, onImportRecords }) {
  const fileRef = useRef(null);
  const [result, setResult] = useState(null); // { wines, records } | { error }

  const total = wines.length + records.length;

  const handleExport = () => {
    downloadJson(`vin-og-vinyl-eksport-${today()}.json`, {
      app: "vin-og-vinyl",
      version: 2,
      exportedAt: new Date().toISOString(),
      wines,
      records,
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const parsed = JSON.parse(await file.text());
      const wineList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.wines)
        ? parsed.wines
        : [];
      const recordList = Array.isArray(parsed?.records) ? parsed.records : [];
      if (!wineList.length && !recordList.length) throw new Error("empty");

      // The hooks validate/normalise (and split record covers) and return counts.
      const w = wineList.length ? await onImportWines(wineList) : 0;
      const r = recordList.length ? await onImportRecords(recordList) : 0;
      setResult({ wines: w, records: r });
    } catch {
      setResult({ error: true });
    }
  };

  const summary = () => {
    if (!result || result.error) return null;
    const parts = [
      result.wines > 0 && `${result.wines} vin${result.wines === 1 ? "" : "er"}`,
      result.records > 0 && `${result.records} plate${result.records === 1 ? "" : "r"}`,
    ].filter(Boolean);
    return parts.length ? `Importerte ${parts.join(" og ")}.` : "Fant ingenting å importere i fila.";
  };

  return (
    <div className="stack">
      <div className="field">
        <label>Eksporter</label>
        <p className="hint" style={{ margin: 0 }}>
          Last ned hele appen — både viner og plater — som én JSON-fil.
        </p>
        <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={!total}>
          ↓ Last ned sikkerhetskopi
        </button>
      </div>

      <hr className="divider" />

      <div className="field">
        <label>Importer</label>
        <p className="hint" style={{ margin: 0 }}>
          Velg en tidligere eksportert JSON-fil. Oppføringer med samme id blir overskrevet, resten legges til.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          ↑ Velg fil og importer
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />

        <div aria-live="polite">
          {result?.error && (
            <p className="error-text">
              Fila kunne ikke leses. Sjekk at det er en gyldig Vin og vinyl-eksport.
            </p>
          )}
          {result && !result.error && (
            <p
              style={{
                color: result.wines + result.records > 0 ? "var(--success)" : "var(--text-soft)",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {summary()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
