import { useCallback } from "react";
import ScreenTitle from "./ScreenTitle.jsx";
import ExportImport from "./ExportImport.jsx";

/**
 * Collection-agnostic settings: one backup file for both wines and records.
 * The import writes straight to IndexedDB in one transaction (ADR-6), so both
 * hooks reload from the database afterwards rather than patching state.
 */
export default function SettingsScreen({ wineDB, recordDB }) {
  const reload = useCallback(
    () => Promise.all([wineDB.refresh(), recordDB.refresh()]),
    [wineDB.refresh, recordDB.refresh]
  );

  return (
    <div style={{ paddingTop: "var(--sp-3)" }}>
      <ScreenTitle>Innstillinger</ScreenTitle>
      <ExportImport wines={wineDB.wines} records={recordDB.records} onImported={reload} />
    </div>
  );
}
