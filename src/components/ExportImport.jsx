import { useRef, useState } from "react";
import { normalizeWine } from "../data/wineSchema.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export the whole cellar to one JSON file, and import/merge one back in. */
export default function ExportImport({ wines, onImport }) {
  const fileRef = useRef(null);
  const [result, setResult] = useState(null); // { added, updated } | { error }

  const handleExport = () => {
    downloadJson(`vin-og-vinyl-eksport-${todayStr()}.json`, { wines });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.wines) ? parsed.wines : null;
      if (!list) throw new Error("invalid_shape");

      const existingIds = new Set(wines.map((w) => w.id));
      let added = 0;
      let updated = 0;
      const valid = [];
      for (const raw of list) {
        const wine = normalizeWine(raw);
        if (!wine) continue;
        if (existingIds.has(wine.id)) updated++;
        else added++;
        valid.push(wine);
      }
      if (!valid.length) throw new Error("empty");

      await onImport(valid);
      setResult({ added, updated });
    } catch {
      setResult({ error: true });
    }
  };

  return (
    <div className="stack">
      <div className="field">
        <label>Eksporter</label>
        <p className="hint" style={{ margin: 0 }}>
          Last ned hele kjelleren som én JSON-fil. Etikettbilder er inkludert, så ingenting går tapt.
        </p>
        <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={!wines.length}>
          ↓ Last ned vin-og-vinyl-eksport
        </button>
      </div>

      <hr className="divider" />

      <div className="field">
        <label>Importer</label>
        <p className="hint" style={{ margin: 0 }}>
          Velg en tidligere eksportert JSON-fil. Viner med samme id blir overskrevet, resten legges til.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          ↑ Velg fil og importer
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />

        <div aria-live="polite">
          {result?.error && <p className="error-text">Fila kunne ikke leses. Sjekk at det er en gyldig Vin og vinyl-eksport.</p>}
          {result && !result.error && (
            <p style={{ color: result.added + result.updated > 0 ? "var(--success)" : "var(--text-soft)", fontSize: 14, fontWeight: 500 }}>
              {result.added === 0 && result.updated === 0
                ? "Ingen viner funnet i fila."
                : [
                    result.added > 0 && `${result.added} nye viner lagt til`,
                    result.updated > 0 && `${result.updated} oppdatert`,
                  ]
                    .filter(Boolean)
                    .join(", ") + "."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
