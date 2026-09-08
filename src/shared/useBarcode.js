import { useCallback, useEffect, useRef, useState } from "react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export const barcodeSupported =
  typeof window !== "undefined" && "BarcodeDetector" in window;

/**
 * Live barcode scanning via the BarcodeDetector API (Android Chrome).
 * Attach `videoRef` to a <video> element, call start(), and receive the
 * first EAN through onDetected. Scanning stops automatically on a hit.
 */
// Matches the visual guide box (.scanner-frame CSS: inset 30% 12%), slightly
// loosened so a barcode near the edge of the box isn't cropped out.
const CROP_TOP_BOTTOM = 0.22;
const CROP_LEFT_RIGHT = 0.08;
const ZOOM_SCALE = 1.6;
// Detecting on every animation frame (~60/sec) repeatedly allocates a large
// zoomed canvas and can overload the camera pipeline on weaker devices,
// causing the stream to be killed mid-scan. A held-still barcode doesn't
// need 60 attempts/sec — throttle actual decode attempts to ~6/sec.
const DETECT_INTERVAL_MS = 160;

export function useBarcode({ onDetected } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Diagnostics only — lets the UI show *why* nothing is happening instead of
  // a silent camera feed. `framesChecked` proves detect() is actually running;
  // `anySeen` proves the device's barcode backend sees *something* (even the
  // wrong format), which rules out "camera works, detection backend doesn't".
  const [debug, setDebug] = useState({
    formats: [],
    framesChecked: 0,
    anySeen: null,
    videoRes: null,
    canvasRes: null,
    torch: "unknown",
  });

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!barcodeSupported) {
      setError(new Error("unsupported"));
      return;
    }
    try {
      let supportedFormats = [];
      if (!detectorRef.current) {
        // Only request formats the device actually supports.
        let formats = FORMATS;
        try {
          supportedFormats = await window.BarcodeDetector.getSupportedFormats();
          formats = FORMATS.filter((f) => supportedFormats.includes(f));
          if (!formats.length) formats = FORMATS;
        } catch {
          /* keep default formats */
        }
        detectorRef.current = new window.BarcodeDetector({ formats });
      }
      setDebug((d) => ({ ...d, formats: supportedFormats }));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // Helps close-range barcode focus on phones that support it; ignored elsewhere.
          advanced: [{ focusMode: "continuous" }],
        },
        audio: false,
      });
      streamRef.current = stream;
      // If the OS/browser kills the camera pipeline mid-scan (e.g. resource
      // pressure), the track fires "ended" instead of throwing — surface it
      // instead of silently going black.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setError(new Error("camera_stream_ended"));
        stop();
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setScanning(true);

      // Turn on the flash automatically if the device supports it — low
      // contrast/lighting is one of the main reasons real-world barcode
      // decoding fails even when the format is supported.
      try {
        const track = stream.getVideoTracks()[0];
        const hasTorch = !!track?.getCapabilities?.().torch;
        if (hasTorch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
          setDebug((d) => ({ ...d, torch: "on" }));
        } else {
          setDebug((d) => ({ ...d, torch: "unsupported" }));
        }
      } catch {
        setDebug((d) => ({ ...d, torch: "failed" }));
      }

      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      let lastDetectAt = 0;
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        const now = performance.now();
        if (now - lastDetectAt < DETECT_INTERVAL_MS) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastDetectAt = now;
        try {
          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          let target = videoRef.current;

          // Digitally "zoom" into the guide-box area: crop out the margins
          // and scale up, giving the decoder more pixels-per-bar on a
          // barcode that's small, angled, or on a curved bottle surface.
          if (vw && vh) {
            const cropX = vw * CROP_LEFT_RIGHT;
            const cropY = vh * CROP_TOP_BOTTOM;
            const cropW = vw - cropX * 2;
            const cropH = vh - cropY * 2;
            canvas.width = cropW * ZOOM_SCALE;
            canvas.height = cropH * ZOOM_SCALE;
            ctx.drawImage(videoRef.current, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
            target = canvas;
          }

          const codes = await detectorRef.current.detect(target);
          setDebug((d) => ({
            ...d,
            framesChecked: d.framesChecked + 1,
            anySeen: codes.length > 0 ? codes.map((c) => `${c.format}:${c.rawValue}`) : d.anySeen,
            videoRes: vw && vh ? `${vw}x${vh}` : d.videoRes,
            canvasRes: target === canvas ? `${canvas.width}x${canvas.height}` : "ingen (video direkte)",
          }));
          const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
          if (hit) {
            stop();
            onDetectedRef.current?.(hit.rawValue);
            return;
          }
        } catch {
          /* transient decode error — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e);
      stop();
    }
  }, [stop]);

  // Clean up camera on unmount.
  useEffect(() => stop, [stop]);

  return { supported: barcodeSupported, scanning, error, videoRef, start, stop, debug };
}
