import ExportImport from "./ExportImport.jsx";

/** Collection-agnostic settings: one backup file for both wines and records. */
export default function SettingsScreen({ wineDB, recordDB }) {
  return (
    <div style={{ paddingTop: "var(--sp-3)" }}>
      <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Innstillinger</h1>
      <ExportImport
        wines={wineDB.wines}
        records={recordDB.records}
        onImportWines={wineDB.importWines}
        onImportRecords={recordDB.importRecords}
      />
    </div>
  );
}
