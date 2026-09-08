import RatingInput from "../../shared/components/RatingInput.jsx";
import Glyph from "../../shared/components/Glyph.jsx";

/** Compact card for the wine list. */
export default function WineCard({ wine, onOpen }) {
  return (
    <button type="button" className="item-card" onClick={() => onOpen(wine)}>
      <div className="card-thumb">
        {wine.labelImageBase64 ? (
          <img src={wine.labelImageBase64} alt="" />
        ) : (
          <Glyph name="wine" className="thumb-glyph" />
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <span className="item-name card-title">
            {wine.name || "Uten navn"}
            {wine.vintage ? ` ${wine.vintage}` : ""}
          </span>
          {wine.wantAgain && (
            <span className="want-again-mark" role="img" aria-label="Vil ha igjen">★</span>
          )}
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
