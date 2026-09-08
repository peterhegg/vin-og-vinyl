import { useEffect, useMemo, useState } from "react";
import { filterAndSortRecords, SORT } from "./useRecordDB.js";
import RecordFilterBar from "./components/RecordFilterBar.jsx";
import RecordSearch from "./components/RecordSearch.jsx";
import RecordForm from "./components/RecordForm.jsx";
import RecordCard from "./components/RecordCard.jsx";
import RecordDetail from "./components/RecordDetail.jsx";

// Content for the vinyl collection. Navigation chrome lives in App; this renders
// whichever screen `nav` points at.
export default function VinylScreen({ nav, db, online, onOpenDetail, onOpenForm, onBack }) {
  const { records, addRecord, updateRecord, deleteRecord, getCover } = db;
  const [filters, setFilters] = useState({ sort: SORT.NEWEST });
  const [detailCover, setDetailCover] = useState(null);

  const visible = useMemo(() => filterAndSortRecords(records, filters), [records, filters]);
  const detailRecord = records.find((r) => r.id === nav.detailId) || null;

  useEffect(() => {
    let alive = true;
    setDetailCover(null);
    if (nav.detailId) getCover(nav.detailId).then((c) => alive && setDetailCover(c));
    return () => {
      alive = false;
    };
  }, [nav.detailId, getCover]);

  const save = async (next, cover) => {
    if (next.id && records.some((r) => r.id === next.id)) await updateRecord(next, cover);
    else await addRecord(next, cover);
    onBack();
  };

  const editRecord = async (record) => {
    const cover = (await getCover(record.id)) ?? null;
    onOpenForm({ initial: record, cover });
  };

  if (detailRecord) {
    return (
      <RecordDetail
        record={detailRecord}
        cover={detailCover}
        onBack={onBack}
        onEdit={editRecord}
        onDelete={async (id) => {
          await deleteRecord(id);
          onBack();
        }}
        onSetStatus={(status) => updateRecord({ ...detailRecord, status })}
      />
    );
  }

  if (nav.form) {
    return (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>
          {nav.form.initial?.id ? "Rediger plate" : "Ny plate"}
        </h1>
        <RecordForm
          initial={nav.form.initial}
          initialCover={nav.form.cover}
          onSave={save}
          onCancel={onBack}
        />
      </div>
    );
  }

  if (nav.tab === "add") {
    return (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Legg til plate</h1>
        {!online && (
          <p className="hint" style={{ marginBottom: "var(--sp-3)" }}>
            Uten nett: Discogs-søk er utilgjengelig, men du kan legge til manuelt.
          </p>
        )}
        <RecordSearch
          onSelect={({ record, cover }) => onOpenForm({ initial: record, cover })}
          onManual={() => onOpenForm({ initial: {}, cover: null })}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <RecordFilterBar filters={filters} onChange={setFilters} />
      {visible.length === 0 ? (
        <div className="empty-state">
          <span className="glyph" aria-hidden="true">♫</span>
          {records.length > 0 ? (
            <>
              <p>Ingen plater matcher filtrene.</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFilters({ sort: SORT.NEWEST })}
              >
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
            <RecordCard key={r.id} record={r} onOpen={(rec) => onOpenDetail(rec.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
