import { useState } from "react";
import { createWine, WINE_TYPES, WINE_STATUS } from "../data/wineSchema.js";
import RatingInput from "../shared/components/RatingInput.jsx";
import PhotoCapture from "../shared/components/PhotoCapture.jsx";
import SegmentedToggle from "../shared/components/SegmentedToggle.jsx";

const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

/** Full editable wine form, prefilled from `initial` (API result, existing wine, or blank). */
export default function WineForm({ initial, onSave, onCancel }) {
  const [wine, setWine] = useState(() => createWine(initial));

  const set = (patch) => setWine((w) => ({ ...w, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    const next = { ...wine };
    next.tastedAt =
      next.status === WINE_STATUS.TASTED
        ? next.tastedAt ?? new Date().toISOString()
        : null;
    onSave(createWine(next));
  };

  return (
    <form onSubmit={submit} className="stack">
      <SegmentedToggle
        ariaLabel="Status"
        value={wine.status}
        onChange={(status) => set({ status })}
        options={[
          { value: WINE_STATUS.TASTED, label: "Smakt" },
          { value: WINE_STATUS.WISH, label: "Ønskeliste" },
        ]}
      />

      <div className="field">
        <label htmlFor="name">Navn</label>
        <input
          id="name"
          required
          value={wine.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      {wine.vinmonopoletUrl && (
        <a
          href={wine.vinmonopoletUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hint"
          style={{ color: "var(--gold)" }}
        >
          Åpne produktsiden på Vinmonopolet for detaljer →
        </a>
      )}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="producer">Produsent</label>
          <input id="producer" value={wine.producer} onChange={(e) => set({ producer: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="vintage">Årgang</label>
          <input
            id="vintage"
            type="number"
            value={wine.vintage ?? ""}
            onChange={(e) => set({ vintage: numOrNull(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" value={wine.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">Velg type…</option>
            {WINE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="supplier">Leverandør</label>
          <input id="supplier" value={wine.supplier} onChange={(e) => set({ supplier: e.target.value })} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="country">Land</label>
          <input id="country" value={wine.country} onChange={(e) => set({ country: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="region">Region</label>
          <input id="region" value={wine.region} onChange={(e) => set({ region: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="subregion">Underregion</label>
        <input id="subregion" value={wine.subregion} onChange={(e) => set({ subregion: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="grapes">Druer (kommaseparert)</label>
        <input
          id="grapes"
          value={wine.grapes.join(", ")}
          onChange={(e) =>
            set({ grapes: e.target.value.split(",").map((g) => g.trim()).filter(Boolean) })
          }
        />
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="alcohol">Alkohol %</label>
          <input
            id="alcohol"
            type="number"
            step="0.1"
            value={wine.alcoholPct ?? ""}
            onChange={(e) => set({ alcoholPct: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="volume">Volum (l)</label>
          <input
            id="volume"
            type="number"
            step="0.01"
            value={wine.volumeLitre ?? ""}
            onChange={(e) => set({ volumeLitre: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="price">Pris (kr)</label>
          <input
            id="price"
            type="number"
            value={wine.priceNOK ?? ""}
            onChange={(e) => set({ priceNOK: numOrNull(e.target.value) })}
          />
        </div>
      </div>

      <hr className="divider" />

      <div className="field">
        <label>Mine korkpoeng</label>
        <RatingInput glyph="cork" label="Korkpoeng" value={wine.myScore} onChange={(myScore) => set({ myScore })} />
      </div>

      <div className="field">
        <label htmlFor="notes">Mine notater</label>
        <textarea id="notes" value={wine.myNotes} onChange={(e) => set({ myNotes: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="food">Matpar</label>
        <input id="food" value={wine.foodPairing} onChange={(e) => set({ foodPairing: e.target.value })} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="purchasedAt">Kjøpt hos</label>
          <input id="purchasedAt" value={wine.purchasedAt} onChange={(e) => set({ purchasedAt: e.target.value })} />
        </div>
        <label className="checkbox-row" style={{ marginTop: 22 }}>
          <input
            type="checkbox"
            checked={wine.wantAgain}
            onChange={(e) => set({ wantAgain: e.target.checked })}
          />
          Vil ha igjen
        </label>
      </div>

      <hr className="divider" />

      <div className="grid-3">
        <div className="field">
          <label htmlFor="quantity">Antall flasker</label>
          <input
            id="quantity"
            type="number"
            min="0"
            value={wine.quantity}
            onChange={(e) => set({ quantity: Math.max(0, numOrNull(e.target.value) ?? 0) })}
          />
        </div>
        <div className="field">
          <label htmlFor="drinkFrom">Drikk fra (år)</label>
          <input
            id="drinkFrom"
            type="number"
            value={wine.drinkFrom ?? ""}
            onChange={(e) => set({ drinkFrom: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="drinkBy">Drikk innen (år)</label>
          <input
            id="drinkBy"
            type="number"
            value={wine.drinkBy ?? ""}
            onChange={(e) => set({ drinkBy: numOrNull(e.target.value) })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cellarLocation">Kjellerplassering</label>
        <input
          id="cellarLocation"
          placeholder="f.eks. Hylle 3, rom B"
          value={wine.cellarLocation}
          onChange={(e) => set({ cellarLocation: e.target.value })}
        />
      </div>

      <PhotoCapture
        label="Etikettbilde"
        value={wine.labelImageBase64}
        onChange={(labelImageBase64) => set({ labelImageBase64 })}
      />

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
