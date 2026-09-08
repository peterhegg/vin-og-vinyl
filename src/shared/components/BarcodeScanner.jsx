import { useEffect, useRef } from "react";
import { useBarcode } from "../useBarcode.js";

/** Full-screen camera overlay. Calls onDetected(ean) once, then onClose(). */
export default function BarcodeScanner({ onDetected, onClose }) {
  const { supported, scanning, error, videoRef, start, stop, debug } = useBarcode({
    onDetected: (ean) => {
      onDetected(ean);
      onClose();
    },
  });
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (supported) start();
    closeBtnRef.current?.focus();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="scanner-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Skann strekkode"
    >
      <div className="scanner-stage">
        {supported ? (
          <video ref={videoRef} className="scanner-video" muted playsInline />
        ) : (
          <div style={{ padding: "var(--sp-5)", color: "var(--text)" }}>
            <p>Strekkodeskanning virker foreløpig kun i Chrome på Android.</p>
            <p className="hint">Bruk søk eller «Legg til manuelt» i stedet.</p>
          </div>
        )}
        {supported && scanning && <div className="scanner-frame" aria-hidden="true" />}
        {error && supported && (
          <p className="error-text" role="alert" style={{ position: "absolute", bottom: 24, left: 16, right: 16 }}>
            {error.message === "camera_stream_ended"
              ? "Kamerastrømmen stoppet uventet. Trykk Avbryt og prøv skann-knappen igjen."
              : "Fikk ikke tilgang til kamera. Sjekk tillatelser."}
          </p>
        )}
        {scanning && (
          <p
            className="hint"
            style={{
              position: "absolute",
              bottom: 8,
              left: 16,
              right: 16,
              fontSize: 11,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            v2 · {debug.framesChecked} bilder · video: {debug.videoRes ?? "?"} · zoom-canvas: {debug.canvasRes ?? "?"} ·
            lommelykt: {debug.torch} · formater: {debug.formats.length ? debug.formats.join(", ") : "ukjent"} ·{" "}
            {debug.anySeen ? `sist sett: ${debug.anySeen.join(", ")}` : "ingen kode sett ennå"}
          </p>
        )}
      </div>
      <div className="scanner-actions">
        <button ref={closeBtnRef} type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={onClose}>
          Avbryt
        </button>
      </div>
    </div>
  );
}
