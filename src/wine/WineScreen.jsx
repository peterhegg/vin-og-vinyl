import { useMemo, useState } from "react";
import { filterAndSortWines, SORT } from "./useWineDB.js";
import { WINE_STATUS } from "./wineSchema.js";
import WineSearch from "./components/WineSearch.jsx";
import WineForm from "./components/WineForm.jsx";
import WineCard from "./components/WineCard.jsx";
import WineDetail from "./components/WineDetail.jsx";
import WineFilterBar from "./components/WineFilterBar.jsx";

// Content for the wine collection. Navigation chrome (segment, bottom nav) lives
// in App; this renders whichever screen `nav` points at.
export default function WineScreen({ nav, db, onOpenDetail, onOpenForm, onBack }) {
  const { wines, addWine, updateWine, deleteWine } = db;
  const [filters, setFilters] = useState({ sort: SORT.NEWEST });

  const visible = useMemo(() => filterAndSortWines(wines, filters), [wines, filters]);
  const detailWine = wines.find((w) => w.id === nav.detailId) || null;

  const save = async (wine) => {
    const next = { ...wine };
    next.tastedAt =
      next.status === WINE_STATUS.TASTED ? next.tastedAt ?? new Date().toISOString() : null;
    if (wine.id && wines.some((w) => w.id === wine.id)) await updateWine(next);
    else await addWine(next);
    onBack();
  };

  if (detailWine) {
    return (
      <WineDetail
        wine={detailWine}
        onBack={onBack}
        onEdit={() => onOpenForm({ initial: detailWine })}
        onDelete={async (id) => {
          await deleteWine(id);
          onBack();
        }}
        onToggleWantAgain={(wantAgain) => updateWine({ ...detailWine, wantAgain })}
      />
    );
  }

  if (nav.form) {
    return (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>
          {nav.form.initial?.id ? "Rediger vin" : "Ny vin"}
        </h1>
        <WineForm initial={nav.form.initial} onSave={save} onCancel={onBack} />
      </div>
    );
  }

  if (nav.tab === "add") {
    return (
      <div style={{ paddingTop: "var(--sp-3)" }}>
        <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Legg til vin</h1>
        <WineSearch
          onSelect={(product) => onOpenForm({ initial: product })}
          onManual={() => onOpenForm({ initial: {} })}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <WineFilterBar filters={filters} onChange={setFilters} />
      {visible.length === 0 ? (
        <div className="empty-state">
          <span className="glyph" aria-hidden="true">🍷</span>
          {wines.length > 0 ? (
            <>
              <p>Ingen viner matcher filtrene.</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFilters({ sort: SORT.NEWEST })}
              >
                Nullstill filtre
              </button>
            </>
          ) : (
            <p>Kjelleren er tom. Trykk «Legg til» og finn din første vin.</p>
          )}
        </div>
      ) : (
        <div className="stack-sm" style={{ gap: 10 }}>
          {visible.map((w) => (
            <WineCard key={w.id} wine={w} onOpen={(wine) => onOpenDetail(wine.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
