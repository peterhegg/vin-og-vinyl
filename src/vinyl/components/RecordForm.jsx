import { useMemo, useState } from "react";
import RatingInput from "../../shared/components/RatingInput.jsx";
import PhotoCapture from "../../shared/components/PhotoCapture.jsx";
import SegmentedToggle from "../../shared/components/SegmentedToggle.jsx";
import { COVER_MAX_WIDTH } from "../../shared/image.js";
import {
  createRecord,
  clampYear,
  clampRating,
  RECORD_STATUS,
  RECORD_STATUS_LABEL,
  RECORD_FORMATS,
  GOLDMINE,
  GOLDMINE_LABEL,
} from "../recordSchema.js";

const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

const splitList = (s) => {
  const seen = new Set();
  const out = [];
  for (const raw of String(s).split(",")) {
    const t = raw.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
};

const GradeSelect = ({ id, label, value, onChange }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Ikke satt</option>
      {GOLDMINE.map((g) => (
        <option key={g} value={g}>{GOLDMINE_LABEL[g]}</option>
      ))}
    </select>
  </div>
);

/**
 * Full editable record form, prefilled from `initial` (a Discogs mapping, an
 * existing record, or blank). `initialCover` is the full-resolution cover that
 * came with a Discogs pick; `onSave(record, cover)` passes `cover` only when the
 * user actually touched it (undefined otherwise — see useRecordDB).
 *
 * The core stays short for quick shelf entry; the rest sits behind "Flere
 * detaljer", opened by default when there's already data to edit.
 */
export default function RecordForm({ initial, initialCover = null, onSave, onCancel }) {
  const [record, setRecord] = useState(() => createRecord(initial));
  const [cover, setCover] = useState(initialCover);
  const [coverTouched, setCoverTouched] = useState(Boolean(initialCover) && !initial?.id);
  const [showMore, setShowMore] = useState(Boolean(initial?.id) || Boolean(initial?.discogsId));

  const set = (patch) => setRecord((r) => ({ ...r, ...patch }));

  const changeCover = (dataUrl) => {
    setCover(dataUrl);
    setCoverTouched(true);
  };

  const formatSet = useMemo(() => new Set(record.formats), [record.formats]);
  const toggleFormat = (f) =>
    setRecord((r) => ({
      ...r,
      formats: r.formats.includes(f) ? r.formats.filter((x) => x !== f) : [...r.formats, f],
    }));

  const submit = (e) => {
    e.preventDefault();
    const next = createRecord({
      ...record,
      releaseYear: clampYear(record.releaseYear),
      originalYear: clampYear(record.originalYear),
      myRating: clampRating(record.myRating),
    });
    onSave(next, coverTouched ? cover : undefined);
  };

  return (
    <form onSubmit={submit} className="stack">
      <SegmentedToggle
        ariaLabel="Status"
        value={record.status}
        onChange={(status) => set({ status })}
        options={[
          { value: RECORD_STATUS.OWNED, label: RECORD_STATUS_LABEL[RECORD_STATUS.OWNED] },
          { value: RECORD_STATUS.WISH, label: RECORD_STATUS_LABEL[RECORD_STATUS.WISH] },
        ]}
      />

      <div className="grid-2">
        <div className="field">
          <label htmlFor="artist">Artist</label>
          <input id="artist" required value={record.artist} onChange={(e) => set({ artist: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="title">Tittel</label>
          <input id="title" required value={record.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>

      {record.discogsUrl && (
        <a
          href={record.discogsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hint"
          style={{ color: "var(--accent)" }}
        >
          Se utgivelsen på Discogs <span aria-hidden="true">→</span>
        </a>
      )}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="releaseYear">Utgivelsesår</label>
          <input
            id="releaseYear"
            type="number"
            inputMode="numeric"
            value={record.releaseYear ?? ""}
            onChange={(e) => set({ releaseYear: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="originalYear">Originalår</label>
          <input
            id="originalYear"
            type="number"
            inputMode="numeric"
            value={record.originalYear ?? ""}
            onChange={(e) => set({ originalYear: numOrNull(e.target.value) })}
          />
        </div>
      </div>
      <p className="hint" style={{ marginTop: -8 }}>
        Utgivelsesår = denne pressingen. Originalår = da musikken først kom ut.
      </p>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="label">Plateselskap</label>
          <input id="label" value={record.label} onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="catalogNumber">Katalognummer</label>
          <input
            id="catalogNumber"
            value={record.catalogNumber}
            onChange={(e) => set({ catalogNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="formats">Format</label>
        <input
          id="formats"
          value={record.formats.join(", ")}
          placeholder="LP, 180g, Gatefold"
          onChange={(e) => set({ formats: splitList(e.target.value) })}
        />
        <div className="chip-row">
          {RECORD_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip${formatSet.has(f) ? " chip--on" : ""}`}
              aria-pressed={formatSet.has(f)}
              onClick={() => toggleFormat(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <PhotoCapture label="Omslagsbilde" value={cover} onChange={changeCover} maxWidth={COVER_MAX_WIDTH} />

      <hr className="divider" />

      <div className="grid-2">
        <GradeSelect
          id="mediaCondition"
          label="Platetilstand"
          value={record.mediaCondition}
          onChange={(mediaCondition) => set({ mediaCondition })}
        />
        <GradeSelect
          id="sleeveCondition"
          label="Omslagstilstand"
          value={record.sleeveCondition}
          onChange={(sleeveCondition) => set({ sleeveCondition })}
        />
      </div>

      <div className="field">
        <label>Min vurdering</label>
        <RatingInput
          glyph="disc"
          label="Min vurdering"
          value={record.myRating}
          onChange={(myRating) => set({ myRating })}
        />
      </div>

      <div className="field">
        <label htmlFor="myNotes">Mine notater</label>
        <textarea id="myNotes" value={record.myNotes} onChange={(e) => set({ myNotes: e.target.value })} />
      </div>

      <hr className="divider" />

      <button
        type="button"
        className="btn-link"
        style={{ alignSelf: "flex-start", paddingLeft: 0 }}
        aria-expanded={showMore}
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? "Færre detaljer" : "Flere detaljer"}
        <span aria-hidden="true">{showMore ? " ▲" : " ▼"}</span>
      </button>

      {showMore && (
        <div className="stack">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="country">Land</label>
              <input id="country" value={record.country} onChange={(e) => set({ country: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="barcode">Strekkode</label>
              <input
                id="barcode"
                inputMode="numeric"
                value={record.barcode ?? ""}
                onChange={(e) => set({ barcode: e.target.value.trim() || null })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="pressingNote">Pressenotat</label>
            <textarea
              id="pressingNote"
              value={record.pressingNote}
              placeholder="f.eks. 2021 reissue, 180 g, gatefold, blå vinyl"
              onChange={(e) => set({ pressingNote: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="genres">Sjanger (kommaseparert)</label>
              <input
                id="genres"
                value={record.genres.join(", ")}
                onChange={(e) => set({ genres: splitList(e.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="styles">Stil (kommaseparert)</label>
              <input
                id="styles"
                value={record.styles.join(", ")}
                onChange={(e) => set({ styles: splitList(e.target.value) })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="conditionNotes">Tilstandsnotat</label>
            <input
              id="conditionNotes"
              value={record.conditionNotes}
              onChange={(e) => set({ conditionNotes: e.target.value })}
            />
          </div>

          <hr className="divider" />

          <div className="grid-2">
            <div className="field">
              <label htmlFor="purchasePriceNOK">Kjøpt for (kr)</label>
              <input
                id="purchasePriceNOK"
                type="number"
                inputMode="numeric"
                value={record.purchasePriceNOK ?? ""}
                onChange={(e) => set({ purchasePriceNOK: numOrNull(e.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="purchaseDate">Kjøpsdato</label>
              <input
                id="purchaseDate"
                type="date"
                value={(record.purchaseDate || "").slice(0, 10)}
                onChange={(e) => set({ purchaseDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="purchasePlace">Kjøpssted</label>
              <input
                id="purchasePlace"
                value={record.purchasePlace}
                onChange={(e) => set({ purchasePlace: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="acquiredAt">Anskaffet</label>
              <input
                id="acquiredAt"
                type="date"
                value={(record.acquiredAt || "").slice(0, 10)}
                onChange={(e) => set({ acquiredAt: e.target.value || null })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="storageLocation">Hylleplass</label>
            <input
              id="storageLocation"
              placeholder="f.eks. Hylle B, kasse 2"
              value={record.storageLocation}
              onChange={(e) => set({ storageLocation: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="plays">Avspillinger</label>
              <input
                id="plays"
                type="number"
                min="0"
                inputMode="numeric"
                value={record.plays}
                onChange={(e) => set({ plays: Math.max(0, Math.trunc(numOrNull(e.target.value) ?? 0)) })}
              />
            </div>
            <div className="field">
              <label htmlFor="estimatedValueNOK">Antatt verdi (kr)</label>
              <input
                id="estimatedValueNOK"
                type="number"
                inputMode="numeric"
                value={record.estimatedValueNOK ?? ""}
                onChange={(e) => set({ estimatedValueNOK: numOrNull(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
          Avbryt
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
          Lagre
        </button>
      </div>
    </form>
  );
}
