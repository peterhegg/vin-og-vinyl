import { useState } from "react";
import RatingInput from "../shared/components/RatingInput.jsx";

const Row = ({ label, value }) =>
  value ? (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null;

/** Full-page single-wine view. */
export default function WineDetail({ wine, onEdit, onDelete, onToggleWantAgain, onBack }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="stack" style={{ paddingTop: "var(--sp-3)" }}>
      <button type="button" className="btn-link" onClick={onBack} style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
        <span aria-hidden="true">←</span> Tilbake
      </button>

      {wine.labelImageBase64 && (
        <img className="detail-hero" src={wine.labelImageBase64} alt={`Etikett — ${wine.name}`} />
      )}

      <div>
        <h2 className="wine-name" style={{ fontSize: "var(--fs-title)" }}>
          {wine.name}
          {wine.vintage ? ` ${wine.vintage}` : ""}
        </h2>
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {[wine.producer, wine.country, wine.region].filter(Boolean).join(" · ")}
        </p>
      </div>

      {wine.myScore != null && <RatingInput glyph="cork" value={wine.myScore} readOnly size={22} />}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onToggleWantAgain(!wine.wantAgain)}
        style={{ alignSelf: "flex-start" }}
      >
        {wine.wantAgain ? "⭐ Vil ha igjen" : "☆ Vil ha igjen?"}
      </button>

      {wine.myNotes && <div className="note-block">{wine.myNotes}</div>}

      <dl className="detail-table" style={{ margin: 0 }}>
        <Row label="Type" value={wine.type} />
        <Row label="Druer" value={wine.grapes?.join(", ")} />
        <Row label="Subregion" value={wine.subregion} />
        <Row label="Alkohol" value={wine.alcoholPct != null ? `${wine.alcoholPct}%` : null} />
        <Row label="Volum" value={wine.volumeLitre != null ? `${wine.volumeLitre} l` : null} />
        <Row label="Pris" value={wine.priceNOK != null ? `${wine.priceNOK} kr` : null} />
        <Row label="Leverandør" value={wine.supplier} />
        <Row label="Matpar" value={wine.foodPairing} />
        <Row label="Kjøpt hos" value={wine.purchasedAt} />
        <Row label="Antall flasker" value={wine.quantity > 0 ? wine.quantity : null} />
        <Row label="Kjellerplassering" value={wine.cellarLocation} />
        <Row
          label="Drikkevindu"
          value={wine.drinkFrom || wine.drinkBy ? `${wine.drinkFrom ?? "?"} – ${wine.drinkBy ?? "?"}` : null}
        />
        {wine.vinmonopoletUrl && (
          <div className="detail-row">
            <dt />
            <dd>
              <a href={wine.vinmonopoletUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
                Se på Vinmonopolet →
              </a>
            </dd>
          </div>
        )}
      </dl>

      {confirmDelete && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          Sletter «{wine.name || "vinen"}» for godt. Dette kan ikke angres.
        </p>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEdit(wine)}>
          Rediger
        </button>
        {!confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Slett
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Behold vinen
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(wine.id)}>
              Slett for godt
            </button>
          </>
        )}
      </div>
    </div>
  );
}
