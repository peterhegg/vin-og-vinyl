import { useEffect, useMemo, useState } from "react";
import { useRecordDB, filterAndSortRecords, SORT } from "./useRecordDB.js";
import RecordFilterBar from "./components/RecordFilterBar.jsx";
import RecordSearch from "./components/RecordSearch.jsx";
import RecordForm from "./components/RecordForm.jsx";
import RecordCard from "./components/RecordCard.jsx";
import RecordDetail from "./components/RecordDetail.jsx";

const TABS = [
  { id: "list", label: "Samling", icon: "🎵" },
  { id: "add", label: "Legg til", icon: "➕" },
];

// INTERIM (Fase 4): this screen carries its own mini-navigation so the vinyl UI
// can be built and reviewed on its own. Fase 5 replaces it with the shared
// app shell + shared/useNav.js (ADR-2) and a combined Settings screen.
export default function VinylScreen({ online }) {
  const { records, addRecord, updateRecord, deleteRecord, getCover, stats } = useRecordDB();

  const [tab, setTab] = useState("list");
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null); // null → no form; { initial, cover }
  const [filters, setFilters] = useState({ sort: SORT.NEWEST });
  const [detailCover, setDetailCover] = useState(null);

  const visible = useMemo(() => filterAndSortRecords(records, filters), [records, filters]);
  const detailRecord = records.find((r) => r.id === detailId) || null;
  const hasAny = records.length > 0;

  useEffect(() => {
    let alive = true;
    setDetailCover(null);
    if (detailId) getCover(detailId).then((c) => alive && setDetailCover(c));
    return () => {
      alive = false;
    };
  }, [detailId, getCover]);

  const closeForm = () => {
    setForm(null);
    setTab("list");
  };

  const saveRecord = async ({ initial }, next, cover) => {
    if (next.id && records.some((r) => r.id === next.id)) {
      await updateRecord(next, cover);
    } else {
      await addRecord(next, cover);
    }
    closeForm();
  };

  const editRecord = async (record) => {
    const cover = (await getCover(record.id)) ?? null;
    setDetailId(null);
    setForm({ initial: record, cover });
    setTab("add");
  };

  const resetFilters = () => setFilters({ sort: SORT.NEWEST });

  let body;
  if (detailRecord) {
    body = (
      <RecordDetail
        record={detailRecord}
        cover={detailCover}
        onBack={() => setDetailId(null)}
        onEdit={editRecord}
        onDelete={async (id) => {
          await deleteRecord(id);
          setDetailId(null);
        }}
        onSetStatus={(status) => updateRecord({ ...detailRecord, status })}
      />
    );
  } else if (form) {
    body = (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>
          {form.initial?.id ? "Rediger plate" : "Ny plate"}
        </h1>
        <RecordForm
          initial={form.initial}
          initialCover={form.cover}
          onSave={(next, cover) => saveRecord(form, next, cover)}
          onCancel={closeForm}
        />
      </div>
    );
  } else if (tab === "list") {
    body = (
      <div className="stack">
        <div className="screen-header">
          <h1 className="screen-title--hero">Vinyl</h1>
          <span className="stats-line">
            <strong>{stats.owned}</strong> plater · <strong>{stats.wish}</strong> ønsket
          </span>
        </div>
        <RecordFilterBar filters={filters} onChange={setFilters} />
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="glyph" aria-hidden="true">♫</span>
            {hasAny ? (
              <>
                <p>Ingen plater matcher filtrene.</p>
                <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                  Nullstill filtre
                </button>
              </>
            ) : (
              <p>Samlingen er tom. Trykk «Legg til» og finn din første plate.</p>
            )}
          </div>
        ) : (
          <div className="stack-sm" style={{ gap: 10 }}>
            {visible.map((r) => (
              <RecordCard key={r.id} record={r} onOpen={(rec) => setDetailId(rec.id)} />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Legg til plate</h1>
        {!online && (
          <p className="hint" style={{ marginBottom: "var(--sp-3)" }}>
            Uten nett: Discogs-søk er utilgjengelig, men du kan legge til manuelt.
          </p>
        )}
        <RecordSearch
          onSelect={({ record, cover }) => setForm({ initial: record, cover })}
          onManual={() => setForm({ initial: {}, cover: null })}
        />
      </div>
    );
  }

  return (
    <>
      {body}
      {!detailRecord && !form && (
        <nav className="bottom-nav" aria-label="Vinyl-navigasjon">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="nav-btn"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon" aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
