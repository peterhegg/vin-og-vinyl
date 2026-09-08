import RatingInput from "../../shared/components/RatingInput.jsx";

/** Compact card for the wine list. */
export default function WineCard({ wine, onOpen }) {
  return (
    <button type="button" className="item-card" onClick={() => onOpen(wine)}>
      <div className="card-thumb">
        {wine.labelImageBase64 ? (
          <img src={wine.labelImageBase64} alt="" />
        ) : (
          <span style={{ fontSize: 22 }} aria-hidden="true">🍷</span>
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <span className="item-name card-title">
            {wine.name || "Uten navn"}
            {wine.vintage ? ` ${wine.vintage}` : ""}
          </span>
          {wine.wantAgain && <span aria-label="Vil ha igjen" title="Vil ha igjen">⭐</span>}
        </div>
        <span className="card-meta">
          {[wine.producer, wine.type, wine.country].filter(Boolean).join(" · ") || "—"}
        </span>
        <div className="card-footer">
          {wine.myScore ? <RatingInput glyph="cork" value={wine.myScore} readOnly size={14} /> : <span />}
          <span className="card-qty">{wine.quantity > 0 ? `${wine.quantity} stk` : ""}</span>
        </div>
      </div>
    </button>
  );
}
