import { WINE_TYPES, WINE_STATUS } from "../data/wineSchema.js";
import { SORT } from "../hooks/useWineDB.js";
import FilterShell from "../shared/components/FilterShell.jsx";

/** Filtering, sorting and free-text search for the wine list. Wine fields; shell is shared (ADR-5). */
export default function FilterBar({ filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <FilterShell
      search={filters.search}
      onSearch={(search) => set({ search })}
      searchPlaceholder="Søk i kjelleren…"
      searchLabel="Søk i kjelleren"
      extra={
        <>
          <input
            className="input"
            placeholder="Land"
            value={filters.country || ""}
            onChange={(e) => set({ country: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Region"
            value={filters.region || ""}
            onChange={(e) => set({ region: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Drue"
            value={filters.grape || ""}
            onChange={(e) => set({ grape: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Produsent"
            value={filters.producer || ""}
            onChange={(e) => set({ producer: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Leverandør"
            value={filters.supplier || ""}
            onChange={(e) => set({ supplier: e.target.value || undefined })}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={!!filters.wantAgain}
              onChange={(e) => set({ wantAgain: e.target.checked || undefined })}
            />
            Vil ha igjen
          </label>
        </>
      }
    >
      <select
        className="input"
        style={{ width: "auto", flex: 1 }}
        value={filters.status || ""}
        onChange={(e) => set({ status: e.target.value || undefined })}
        aria-label="Status"
      >
        <option value="">Alle</option>
        <option value={WINE_STATUS.TASTED}>Smakt</option>
        <option value={WINE_STATUS.WISH}>Ønskeliste</option>
      </select>

      <select
        className="input"
        style={{ width: "auto", flex: 1.4 }}
        value={filters.sort || SORT.NEWEST}
        onChange={(e) => set({ sort: e.target.value })}
        aria-label="Sortering"
      >
        <option value={SORT.NEWEST}>Nyest tilsatt</option>
        <option value={SORT.SCORE_DESC}>Høyest poengsum</option>
        <option value={SORT.PRICE_ASC}>Lavest pris</option>
        <option value={SORT.NAME_ASC}>Navn A–Å</option>
      </select>

      <select
        className="input"
        style={{ width: "auto", flex: 1 }}
        value={filters.type || ""}
        onChange={(e) => set({ type: e.target.value || undefined })}
        aria-label="Type"
      >
        <option value="">Alle typer</option>
        {WINE_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </FilterShell>
  );
}
