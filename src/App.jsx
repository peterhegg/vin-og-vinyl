import { useEffect, useMemo, useState } from "react";
import { useWineDB, filterAndSortWines, SORT } from "./wine/useWineDB.js";
import WineSearch from "./wine/components/WineSearch.jsx";
import WineForm from "./wine/components/WineForm.jsx";
import WineCard from "./wine/components/WineCard.jsx";
import WineDetail from "./wine/components/WineDetail.jsx";
import WineFilterBar from "./wine/components/WineFilterBar.jsx";
import ExportImport from "./shared/components/ExportImport.jsx";
import SegmentedToggle from "./shared/components/SegmentedToggle.jsx";
import VinylScreen from "./vinyl/VinylScreen.jsx";

const TABS = [
  { id: "cellar", label: "Kjeller", icon: "🍷" },
  { id: "add", label: "Legg til", icon: "➕" },
  { id: "settings", label: "Innstillinger", icon: "⚙️" },
];

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function App() {
  const { wines, addWine, updateWine, deleteWine, stats, importWines } = useWineDB();
  const online = useOnlineStatus();

  // INTERIM (Fase 4): a plain toggle between the wine app and the vinyl app so
  // the vinyl UI can be reviewed. Fase 5 replaces this with the shared shell,
  // shared/useNav.js and a combined Settings screen (ADR-2).
  const [collection, setCollection] = useState("wine");
  const [tab, setTab] = useState("cellar");
  const [detailId, setDetailId] = useState(null);
  const [formInitial, setFormInitial] = useState(null); // non-null → form screen is showing
  const [filters, setFilters] = useState({ sort: SORT.NEWEST });

  const visibleWines = useMemo(() => filterAndSortWines(wines, filters), [wines, filters]);
  const detailWine = wines.find((w) => w.id === detailId) || null;
  const hasAnyWines = wines.length > 0;

  const closeForm = () => {
    setFormInitial(null);
    setTab("cellar");
  };

  const saveWine = async (wine) => {
    if (wine.id && wines.some((w) => w.id === wine.id)) {
      await updateWine(wine);
    } else {
      await addWine(wine);
    }
    closeForm();
  };

  const editWine = (wine) => {
    setDetailId(null);
    setFormInitial(wine);
    setTab("add");
  };

  return (
    <div className="app-shell" data-collection={collection}>
      {!online && <div className="offline-banner">Ingen nettforbindelse — søk krever nett</div>}

      <SegmentedToggle
        ariaLabel="Samling"
        value={collection}
        onChange={setCollection}
        options={[
          { value: "wine", label: "Vin" },
          { value: "vinyl", label: "Vinyl" },
        ]}
      />

      {collection === "vinyl" ? (
        <VinylScreen online={online} />
      ) : (
      <>
      {detailWine ? (
        <WineDetail
          wine={detailWine}
          onBack={() => setDetailId(null)}
          onEdit={editWine}
          onDelete={async (id) => {
            await deleteWine(id);
            setDetailId(null);
          }}
          onToggleWantAgain={(wantAgain) => updateWine({ ...detailWine, wantAgain })}
        />
      ) : formInitial !== null ? (
        <div style={{ paddingTop: "var(--sp-3)" }}>
          <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>
            {formInitial.id ? "Rediger vin" : "Ny vin"}
          </h1>
          <WineForm initial={formInitial} onSave={saveWine} onCancel={closeForm} />
        </div>
      ) : tab === "cellar" ? (
        <div className="stack">
          <div className="screen-header">
            <h1 className="screen-title--hero">Vin og vinyl</h1>
            <span className="stats-line">
              <strong>{stats.tasted}</strong> smakt · <strong>{stats.bottles}</strong> flasker
            </span>
          </div>
          <WineFilterBar filters={filters} onChange={setFilters} />
          {visibleWines.length === 0 ? (
            <div className="empty-state">
              <span className="glyph" aria-hidden="true">🍷</span>
              {hasAnyWines ? (
                <>
                  <p>Ingen viner matcher filtrene.</p>
                  <button type="button" className="btn btn-ghost" onClick={() => setFilters({ sort: SORT.NEWEST })}>
                    Nullstill filtre
                  </button>
                </>
              ) : (
                <p>Kjelleren er tom. Trykk «Legg til» og finn din første vin.</p>
              )}
            </div>
          ) : (
            <div className="stack-sm" style={{ gap: 10 }}>
              {visibleWines.map((w) => (
                <WineCard key={w.id} wine={w} onOpen={(wine) => setDetailId(wine.id)} />
              ))}
            </div>
          )}
        </div>
      ) : tab === "add" ? (
        <div style={{ paddingTop: "var(--sp-3)" }}>
          <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Legg til vin</h1>
          <WineSearch
            onSelect={(product) => setFormInitial(product)}
            onManual={() => setFormInitial({})}
          />
        </div>
      ) : (
        <div style={{ paddingTop: "var(--sp-3)" }}>
          <h1 className="screen-title" style={{ marginBottom: "var(--sp-4)" }}>Innstillinger</h1>
          <ExportImport wines={wines} onImport={importWines} />
        </div>
      )}

      {!detailWine && formInitial === null && (
        <nav className="bottom-nav" aria-label="Hovednavigasjon">
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
      )}
    </div>
  );
}
