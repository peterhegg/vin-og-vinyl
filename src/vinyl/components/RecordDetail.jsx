import { useState } from "react";
import { useFocusOnMount } from "../../shared/useFocusOnMount.js";
import RatingInput from "../../shared/components/RatingInput.jsx";
import SegmentedToggle from "../../shared/components/SegmentedToggle.jsx";
import {
  RECORD_STATUS,
  RECORD_STATUS_LABEL,
  GOLDMINE_LABEL,
  musicYear,
  recordLabel,
} from "../recordSchema.js";

const Row = ({ label, value }) =>
  value ? (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null;

const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : null);

/** Full-page single-record view. `cover` is the full-resolution image (ADR-4), fetched by the screen. */
export default function RecordDetail({ record, cover, onEdit, onDelete, onBack, onSetStatus }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headingRef = useFocusOnMount();
  const year = musicYear(record);
  const hero = cover || record.coverThumbBase64;

  return (
    <div className="stack" style={{ paddingTop: "var(--sp-3)" }}>
      <button type="button" className="btn-link" onClick={onBack} style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
        <span aria-hidden="true">←</span> Tilbake
      </button>

      {hero && <img className="detail-hero" src={hero} alt={`Omslag — ${recordLabel(record)}`} />}

      <div>
        <h2
          className="item-name"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "var(--fs-title)", outline: "none" }}
        >
          {record.artist || "Ukjent artist"}
        </h2>
        <p className="item-name" style={{ margin: "2px 0 0", color: "var(--text)" }}>{record.title}</p>
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {[year, record.label, record.catalogNumber, record.country].filter(Boolean).join(" · ")}
        </p>
      </div>

      {record.myRating != null && <RatingInput glyph="disc" value={record.myRating} readOnly size={22} />}

      <SegmentedToggle
        ariaLabel="Status"
        value={record.status}
        onChange={onSetStatus}
        options={[
          { value: RECORD_STATUS.OWNED, label: RECORD_STATUS_LABEL[RECORD_STATUS.OWNED] },
          { value: RECORD_STATUS.WISH, label: RECORD_STATUS_LABEL[RECORD_STATUS.WISH] },
        ]}
      />

      {record.myNotes && <div className="note-block">{record.myNotes}</div>}
      {record.pressingNote && <p className="hint" style={{ margin: 0 }}>{record.pressingNote}</p>}

      <dl className="detail-table" style={{ margin: 0 }}>
        <Row label="Format" value={(record.formats || []).join(", ")} />
        <Row label="Utgivelsesår" value={record.releaseYear} />
        <Row
          label="Originalår"
          value={record.originalYear && record.originalYear !== record.releaseYear ? record.originalYear : null}
        />
        <Row label="Sjanger" value={(record.genres || []).join(", ")} />
        <Row label="Stil" value={(record.styles || []).join(", ")} />
        <Row label="Plate" value={record.mediaCondition ? GOLDMINE_LABEL[record.mediaCondition] : null} />
        <Row label="Omslag" value={record.sleeveCondition ? GOLDMINE_LABEL[record.sleeveCondition] : null} />
        <Row label="Tilstandsnotat" value={record.conditionNotes} />
        <Row label="Strekkode" value={record.barcode} />
        <Row label="Kjøpt for" value={record.purchasePriceNOK != null ? `${record.purchasePriceNOK} kr` : null} />
        <Row label="Kjøpsdato" value={dateOnly(record.purchaseDate)} />
        <Row label="Kjøpssted" value={record.purchasePlace} />
        <Row label="Anskaffet" value={dateOnly(record.acquiredAt)} />
        <Row label="Hylleplass" value={record.storageLocation} />
        <Row label="Avspillinger" value={record.plays > 0 ? record.plays : null} />
        <Row label="Antatt verdi" value={record.estimatedValueNOK != null ? `${record.estimatedValueNOK} kr` : null} />
        <Row label="Lagt til" value={dateOnly(record.addedAt)} />
        {record.discogsUrl && (
          <div className="detail-row">
            <dt />
            <dd>
              <a href={record.discogsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                Se utgivelsen på Discogs <span aria-hidden="true">→</span>
              </a>
            </dd>
          </div>
        )}
      </dl>

      {confirmDelete && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          Sletter «{recordLabel(record)}» for godt. Dette kan ikke angres.
        </p>
      )}
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEdit(record)}>
          Rediger
        </button>
        {!confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Slett
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Behold plata
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(record.id)}>
              Slett for godt
            </button>
          </>
        )}
      </div>
    </div>
  );
}
