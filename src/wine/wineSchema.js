// Field definitions for one wine. Single source of truth for the data model.

import { safeExternalUrl, safeImageDataUrl } from "../shared/sanitize.js";

// Re-exported so existing imports of these helpers keep working.
export { safeExternalUrl, safeImageDataUrl };

export const WINE_STATUS = {
  TASTED: "smakt",
  WISH: "ønske",
};

export const WINE_TYPES = [
  "Rødvin",
  "Hvitvin",
  "Rosévin",
  "Musserende",
  "Dessertvin",
  "Sterkvin",
];

/**
 * Returns a fresh, fully-shaped wine object with sensible defaults.
 * Every persisted wine has exactly these keys so queries/indexes stay stable.
 */
export function createWine(partial = {}) {
  return {
    id: partial.id ?? crypto.randomUUID(),
    status: partial.status ?? WINE_STATUS.TASTED,
    addedAt: partial.addedAt ?? new Date().toISOString(),
    tastedAt: partial.tastedAt ?? null,

    // From Vinmonopolet or manual entry
    name: partial.name ?? "",
    producer: partial.producer ?? "",
    supplier: partial.supplier ?? "",
    country: partial.country ?? "",
    region: partial.region ?? "",
    subregion: partial.subregion ?? "",
    grapes: partial.grapes ?? [],
    vintage: partial.vintage ?? null,
    type: partial.type ?? "",
    alcoholPct: partial.alcoholPct ?? null,
    volumeLitre: partial.volumeLitre ?? null,
    priceNOK: partial.priceNOK ?? null,
    vinmonopoletId: partial.vinmonopoletId ?? null,
    vinmonopoletUrl: safeExternalUrl(partial.vinmonopoletUrl),
    barcode: partial.barcode ?? null,

    // User fields
    myScore: partial.myScore ?? null, // 1–10 corks
    myNotes: partial.myNotes ?? "",
    foodPairing: partial.foodPairing ?? "",
    purchasedAt: partial.purchasedAt ?? "",
    wantAgain: partial.wantAgain ?? false,

    // Cellar / inventory
    quantity: partial.quantity ?? 0,
    cellarLocation: partial.cellarLocation ?? "",
    drinkFrom: partial.drinkFrom ?? null, // year (number) or null
    drinkBy: partial.drinkBy ?? null, // year (number) or null

    // Image
    labelImageBase64: safeImageDataUrl(partial.labelImageBase64),
  };
}

// Keys that must never be lost on update/import merge.
export const WINE_KEYS = Object.keys(createWine());

/** Coerce an arbitrary (imported/parsed) object into a valid wine. */
export function normalizeWine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const wine = createWine(raw);
  // Guard the few numeric/array fields against bad import data.
  wine.grapes = Array.isArray(raw.grapes) ? raw.grapes.filter((g) => typeof g === "string") : [];
  wine.myScore = clampScore(raw.myScore);
  wine.quantity = Number.isFinite(+raw.quantity) ? Math.max(0, Math.trunc(+raw.quantity)) : 0;
  wine.wantAgain = Boolean(raw.wantAgain);
  if (raw.status !== WINE_STATUS.TASTED && raw.status !== WINE_STATUS.WISH) {
    wine.status = WINE_STATUS.TASTED;
  }
  return wine;
}

export function clampScore(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  if (n < 1) return null;
  return Math.min(10, n);
}
