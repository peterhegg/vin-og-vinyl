import { useWineDB } from "./wine/useWineDB.js";
import { useRecordDB } from "./vinyl/useRecordDB.js";
import { useNav } from "./shared/useNav.js";
import { useOnlineStatus } from "./shared/useOnlineStatus.js";
import SegmentedToggle from "./shared/components/SegmentedToggle.jsx";
import SettingsScreen from "./shared/components/SettingsScreen.jsx";
import Glyph from "./shared/components/Glyph.jsx";
import WineScreen from "./wine/WineScreen.jsx";
import VinylScreen from "./vinyl/VinylScreen.jsx";

const TABS = [
  { id: "list", label: "Samling", icon: "collection" },
  { id: "add", label: "Legg til", icon: "add" },
  { id: "settings", label: "Innstillinger", icon: "settings" },
];

// App shell (ADR-2): the segment + combined count is the "home", one of three
// screens sits in the middle, bottom nav below. Detail and form screens take
// over the whole shell (no segment, no bottom nav).
export default function App() {
  const wineDB = useWineDB();
  const recordDB = useRecordDB();
  const online = useOnlineStatus();
  const { nav, back, setCollection, setTab, openDetail, openForm } = useNav();

  const inSubview = Boolean(nav.detailId || nav.form);
  const onSettings = nav.tab === "settings" && !inSubview;
  const showSegment = !inSubview && !onSettings;

  const screenProps = {
    nav,
    online,
    onOpenDetail: openDetail,
    onOpenForm: openForm,
    onBack: back,
  };

  return (
    <div className="app-shell" data-collection={onSettings ? undefined : nav.collection}>
      {!online && (
        <div className="offline-banner" role="status">
          Uten nett nå — du kan bla og redigere, men ikke søke
        </div>
      )}

      {showSegment && (
        <div className="collection-switch">
          <SegmentedToggle
            ariaLabel="Samling"
            value={nav.collection}
            onChange={setCollection}
            options={[
              { value: "wine", label: "Vin" },
              { value: "vinyl", label: "Vinyl" },
            ]}
          />
          {nav.tab === "list" && (
            <p className="collection-count">
              <strong data-active={nav.collection === "wine"}>{wineDB.wines.length}</strong>
              {wineDB.wines.length === 1 ? " vin" : " viner"}
              {"  ·  "}
              <strong data-active={nav.collection === "vinyl"}>{recordDB.records.length}</strong>
              {recordDB.records.length === 1 ? " plate" : " plater"}
            </p>
          )}
        </div>
      )}

      <main>
        {onSettings ? (
          <SettingsScreen wineDB={wineDB} recordDB={recordDB} />
        ) : nav.collection === "vinyl" ? (
          <VinylScreen db={recordDB} {...screenProps} />
        ) : (
          <WineScreen db={wineDB} {...screenProps} />
        )}
      </main>

      {!inSubview && (
        <nav className="bottom-nav" aria-label="Hovednavigasjon">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="nav-btn"
              aria-current={nav.tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">
                <Glyph name={t.icon} />
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
