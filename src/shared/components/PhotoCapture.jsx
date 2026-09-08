import { useRef, useState } from "react";
import { compressImage } from "../image.js";

/**
 * Camera / gallery image picker. Knows no domain fields (ADR-5): `label` names
 * the thing being photographed, `maxWidth` bounds the stored image. Emits one
 * JPEG data URL (or null on removal). Replaces the wine-only LabelPhoto.
 *
 * A record's inline thumbnail is derived downstream by useRecordDB (ADR-4);
 * this component only produces the full-size image.
 */
export default function PhotoCapture({ label = "Bilde", value, onChange, maxWidth }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await compressImage(file, maxWidth));
    } catch {
      // A file the browser cannot decode, or one too large to fit on a canvas.
      // Saying so beats a button that quietly does nothing.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      {value && (
        <img
          src={value}
          alt={label}
          style={{ width: "100%", maxWidth: 240, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}
        />
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost" onClick={() => cameraRef.current?.click()} disabled={busy}>
          <span aria-hidden="true">📷</span> {busy ? "Behandler …" : "Ta bilde"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()} disabled={busy}>
          <span aria-hidden="true">🖼️</span> Velg fra galleri
        </button>
        {value && (
          <button type="button" className="btn btn-danger" onClick={() => onChange(null)}>
            Fjern bilde
          </button>
        )}
      </div>
      {failed && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          Klarte ikke å lese bildet. Prøv et annet, eller ta et nytt.
        </p>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}
