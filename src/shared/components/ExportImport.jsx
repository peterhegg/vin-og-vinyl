import { useRef, useState } from "react";
import { exportBackup, importBackupFile, BackupError } from "../backup.js";

const ERROR_TEXT = {
  invalid_json:
    "Dette ser ikke ut som en sikkerhetskopi fra Vin og vinyl. Velg en fil du har lastet ned herfra.",
  not_a_backup:
    "Dette ser ikke ut som en sikkerhetskopi fra Vin og vinyl. Velg en fil du har lastet ned herfra.",
  future_version:
    "Sikkerhetskopien er laget av en nyere versjon av appen. Oppdater appen først. Ingenting ble endret.",
  empty: "Sikkerhetskopien er tom — ingenting å importere.",
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

  const isEmpty = wines.length + records.length === 0;

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
      : "Fila hadde ingen oppføringer å importere.";
  };

  return (
    <div className="stack">
      <div className="field">
        <label>Eksporter</label>
        <p className="hint" style={{ margin: 0 }}>
          Last ned hele samlingen — viner og plater med coverbilder — som én fil, til
          sikkerhetskopi eller flytting til en annen enhet.
        </p>
        {isEmpty ? (
          <p className="hint" style={{ margin: 0 }}>
            Ingenting å eksportere ennå. Legg til en vin eller plate først.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleExport}
            disabled={busy !== null}
          >
            {busy === "export" ? "Lager sikkerhetskopi …" : (
              <>
                <span aria-hidden="true">↓</span> Last ned sikkerhetskopi
              </>
            )}
          </button>
        )}
      </div>

      <hr className="divider" />

      <div className="field">
        <label>Importer</label>
        <p className="hint" style={{ margin: 0 }}>
          Velg en sikkerhetskopi du har lastet ned tidligere. Oppføringer du alt har blir
          oppdatert, resten legges til. Eldre filer med bare vin fungerer også.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === "import" ? "Importerer …" : (
            <>
              <span aria-hidden="true">↑</span> Velg fil og importer
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />

        <div aria-live="polite" role="status">
          {result?.error === "empty" && (
            <p style={{ color: "var(--text-soft)", fontSize: 14, fontWeight: 500 }}>
              {ERROR_TEXT.empty}
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
