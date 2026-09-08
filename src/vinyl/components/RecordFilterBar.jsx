import FilterShell from "../../shared/components/FilterShell.jsx";
import { SORT } from "../useRecordDB.js";
import { RECORD_STATUS, RECORD_STATUS_LABEL, GOLDMINE, GOLDMINE_LABEL } from "../recordSchema.js";

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

/** Filtering, sorting and search for the vinyl list. Vinyl fields; shell is shared (ADR-5). */
export default function RecordFilterBar({ filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <FilterShell
      search={filters.search}
      onSearch={(search) => set({ search })}
      searchPlaceholder="Søk i samlingen…"
      searchLabel="Søk i platesamlingen"
      extra={
        <>
          <input
            className="input"
            placeholder="Artist"
            aria-label="Filtrer på artist"
            value={filters.artist || ""}
            onChange={(e) => set({ artist: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Plateselskap"
            aria-label="Filtrer på plateselskap"
            value={filters.label || ""}
            onChange={(e) => set({ label: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Sjanger"
            aria-label="Filtrer på sjanger"
            value={filters.genre || ""}
            onChange={(e) => set({ genre: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Stil"
            aria-label="Filtrer på stil"
            value={filters.style || ""}
            onChange={(e) => set({ style: e.target.value || undefined })}
          />
          <input
            className="input"
            placeholder="Format"
            aria-label="Filtrer på format"
            value={filters.format || ""}
            onChange={(e) => set({ format: e.target.value || undefined })}
          />
          <select
            className="input"
            value={filters.decade || ""}
            onChange={(e) => set({ decade: e.target.value ? Number(e.target.value) : undefined })}
            aria-label="Tiår"
          >
            <option value="">Alle tiår</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>{d}-tallet</option>
            ))}
          </select>
          <select
            className="input"
            value={filters.condition || ""}
            onChange={(e) => set({ condition: e.target.value || undefined })}
            aria-label="Minste platetilstand"
          >
            <option value="">Alle tilstander</option>
            {GOLDMINE.map((g) => (
              <option key={g} value={g}>Minst {GOLDMINE_LABEL[g]}</option>
            ))}
          </select>
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
        <option value={RECORD_STATUS.OWNED}>{RECORD_STATUS_LABEL[RECORD_STATUS.OWNED]}</option>
        <option value={RECORD_STATUS.WISH}>{RECORD_STATUS_LABEL[RECORD_STATUS.WISH]}</option>
      </select>

      <select
        className="input"
        style={{ width: "auto", flex: 1.4 }}
        value={filters.sort || SORT.NEWEST}
        onChange={(e) => set({ sort: e.target.value })}
        aria-label="Sortering"
      >
        <option value={SORT.NEWEST}>Nyest lagt til</option>
        <option value={SORT.ARTIST_ASC}>Artist A–Å</option>
        <option value={SORT.TITLE_ASC}>Tittel A–Å</option>
        <option value={SORT.YEAR_DESC}>År (nyest)</option>
        <option value={SORT.YEAR_ASC}>År (eldst)</option>
        <option value={SORT.RATING_DESC}>Høyest vurdert</option>
      </select>
    </FilterShell>
  );
}
