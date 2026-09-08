import { useRef, useState } from "react";
import { exportBackup, importBackupFile, BackupError } from "../backup.js";

const ERROR_TEXT = {
  invalid_json: "Fila kunne ikke leses. Sjekk at det er en gyldig Vin og vinyl-eksport.",
  not_a_backup: "Fila kunne ikke leses. Sjekk at det er en gyldig Vin og vinyl-eksport.",
  future_version:
    "Fila er laget av en nyere versjon av appen. Oppdater appen før du importerer — ingenting ble endret.",
  export_failed: "Kunne ikke lage sikkerhetskopien. Prøv igjen.",
  import_failed: "Importen feilet. Ingenting ble endret.",
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * One backup file for the whole app. The format itself — writing, v1/v2 reading,
 * sanitising and the single import transaction — lives in `shared/backup.js`.
 * This component only picks the file and reports what happened.
 */
export default function ExportImport({ wines, records, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // "export" | "import" | null
  const [result, setResult] = useState(null); // { wines, records } | { error: code }

  const total = wines.length + records.length;

  const handleExport = async () => {
    setResult(null);
    setBusy("export");
    try {
      await exportBackup({ wines, records });
    } catch {
      setResult({ error: "export_failed" });
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    setBusy("import");
    try {
      const counts = await importBackupFile(file);
      setResult(counts);
      await onImported?.();
    } catch (err) {
      setResult({ error: err instanceof BackupError ? err.code : "import_failed" });
    } finally {
      setBusy(null);
    }
  };

  const summary = () => {
    const parts = [
      result.wines > 0 && plural(result.wines, "vin", "viner"),
      result.records > 0 && plural(result.records, "plate", "plater"),
    ].filter(Boolean);
    return parts.length
      ? `Importerte ${parts.join(" og ")}.`
      : "Fant ingenting å importere i fila.";
  };

  return (
    <div className="stack">
      <div className="field">
        <label>Eksporter</label>
        <p className="hint" style={{ margin: 0 }}>
          Last ned hele appen — både viner og plater, med coverbilder — som én JSON-fil.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleExport}
          disabled={!total || busy !== null}
        >
          {busy === "export" ? "Lager sikkerhetskopi …" : "↓ Last ned sikkerhetskopi"}
        </button>
      </div>

      <hr className="divider" />

      <div className="field">
        <label>Importer</label>
        <p className="hint" style={{ margin: 0 }}>
          Velg en tidligere eksportert JSON-fil. Oppføringer med samme id blir overskrevet,
          resten legges til. Eldre filer med bare viner virker fortsatt.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === "import" ? "Importerer …" : "↑ Velg fil og importer"}
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />

        <div aria-live="polite">
          {result?.error === "empty" && (
            <p style={{ color: "var(--text-soft)", fontSize: 14, fontWeight: 500 }}>
              Fant ingenting å importere i fila.
            </p>
          )}
          {result?.error && result.error !== "empty" && (
            <p className="error-text">{ERROR_TEXT[result.error] ?? ERROR_TEXT.import_failed}</p>
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
