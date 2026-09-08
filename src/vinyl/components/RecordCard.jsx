import RatingInput from "../../shared/components/RatingInput.jsx";
import { RECORD_STATUS, musicYear } from "../recordSchema.js";

// The format a collector names first ("it's a 2xLP") — fall back to whatever's there.
const CARRIERS = ["3xLP", "2xLP", "LP", "Box", "12\"", "10\"", "7\""];
const primaryFormat = (formats = []) => CARRIERS.find((c) => formats.includes(c)) || formats[0];

/** Compact card for the vinyl list. Renders the inline thumbnail only (ADR-4). */
export default function RecordCard({ record, onOpen }) {
  const year = musicYear(record);
  const meta =
    [year, record.label, primaryFormat(record.formats)].filter(Boolean).join(" · ") || "—";

  return (
    <button type="button" className="item-card" onClick={() => onOpen(record)}>
      <div className="card-thumb">
        {record.coverThumbBase64 ? (
          <img src={record.coverThumbBase64} alt="" />
        ) : (
          <span style={{ fontSize: 22 }} aria-hidden="true">💿</span>
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <span className="item-name card-title">{record.artist || "Ukjent artist"}</span>
          {record.status === RECORD_STATUS.WISH && (
            <span className="tag" aria-label="På ønskelista">Ønske</span>
          )}
        </div>
        <span className="card-meta">{record.title || "Uten tittel"}</span>
        <span className="card-meta">{meta}</span>
        <div className="card-footer">
          {record.myRating ? (
            <RatingInput glyph="disc" value={record.myRating} readOnly size={14} />
          ) : (
            <span />
          )}
          {record.mediaCondition && <span className="card-qty">{record.mediaCondition}</span>}
        </div>
      </div>
    </button>
  );
}
