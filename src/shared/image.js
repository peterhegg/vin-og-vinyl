// Image downscaling shared by every collection. Browser-only (uses canvas).

export const COVER_MAX_WIDTH = 800;
export const THUMB_MAX_WIDTH = 160;

const JPEG_QUALITY = 0.7;
const THUMB_QUALITY = 0.6;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isBlob = typeof source !== "string";
    const url = isBlob ? URL.createObjectURL(source) : source;
    img.onload = () => {
      if (isBlob) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (isBlob) URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

/**
 * Downscale a File, Blob or data URL to a JPEG data URL no wider than maxWidth.
 * Images already narrower are re-encoded but never upscaled.
 */
export async function compressImage(source, maxWidth = COVER_MAX_WIDTH, quality = JPEG_QUALITY) {
  const img = await loadImage(source);
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // JPEG has no alpha — paint a white ground so transparent PNGs don't turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

/** The small copy that lives inline in a record and is what lists render (ADR-4). */
export function makeThumbnail(source) {
  return compressImage(source, THUMB_MAX_WIDTH, THUMB_QUALITY);
}
