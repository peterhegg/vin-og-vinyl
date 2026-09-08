// Field definitions for one wine. Single source of truth for the data model.

import {
  safeExternalUrl,
  safeImageDataUrl,
  safeText,
  safeTextOrNull,
  safeNumber,
  safeCount,
  safeId,
  safeIsoDate,
} from "../shared/sanitize.js";

// Re-exported so existing imports of these helpers keep working.
export { safeExternalUrl, safeImageDataUrl };

const YEAR = { min: 1800, max: 2200, integer: true };

/** Bounded on both axes: an import file must not be able to define 10 000 grapes. */
function grapeList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const g of v) {
    if (typeof g !== "string") continue;
    const trimmed = g.slice(0, 100).trim();
    if (trimmed) out.push(trimmed);
    if (out.length >= 32) break;
  }
  return out;
}

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
 * Every persisted wine has exactly these keys, with exactly these types, so
 * queries/indexes stay stable.
 *
 * Every field is coerced here rather than in normalizeWine: this is the single
 * gate every write passes through — `dbPutWine` calls it directly — so a field
 * validated only in normalizeWine would still be reachable from the UI path.
 */
export function createWine(partial = {}) {
  return {
    id: safeId(partial.id),
    status: partial.status === WINE_STATUS.WISH ? WINE_STATUS.WISH : WINE_STATUS.TASTED,
    addedAt: safeIsoDate(partial.addedAt, new Date().toISOString()),
    tastedAt: safeIsoDate(partial.tastedAt),

    // From Vinmonopolet or manual entry
    name: safeText(partial.name, 300),
    producer: safeText(partial.producer, 200),
    supplier: safeText(partial.supplier, 200),
    country: safeText(partial.country, 100),
    region: safeText(partial.region, 100),
    subregion: safeText(partial.subregion, 100),
    grapes: grapeList(partial.grapes),
    vintage: safeNumber(partial.vintage, YEAR),
    type: safeText(partial.type, 60),
    alcoholPct: safeNumber(partial.alcoholPct, { min: 0, max: 100 }),
    volumeLitre: safeNumber(partial.volumeLitre, { min: 0, max: 100 }),
    priceNOK: safeNumber(partial.priceNOK, { min: 0, max: 1e9 }),
    vinmonopoletId: safeTextOrNull(partial.vinmonopoletId, 60),
    vinmonopoletUrl: safeExternalUrl(partial.vinmonopoletUrl),
    barcode: safeTextOrNull(partial.barcode, 32),

    // User fields
    myScore: clampScore(partial.myScore), // 1–10 corks
    myNotes: safeText(partial.myNotes),
    foodPairing: safeText(partial.foodPairing),
    purchasedAt: safeText(partial.purchasedAt, 200),
    wantAgain: Boolean(partial.wantAgain),

    // Cellar / inventory
    quantity: safeCount(partial.quantity),
    cellarLocation: safeText(partial.cellarLocation, 200),
    drinkFrom: safeNumber(partial.drinkFrom, YEAR), // year (number) or null
    drinkBy: safeNumber(partial.drinkBy, YEAR), // year (number) or null

    // Image
    labelImageBase64: safeImageDataUrl(partial.labelImageBase64),
  };
}

// Keys that must never be lost on update/import merge.
export const WINE_KEYS = Object.keys(createWine());

/**
 * Coerce an arbitrary (imported/parsed) object into a valid wine, or reject it.
 * The field-by-field coercion lives in createWine.
 */
export function normalizeWine(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return createWine(raw);
}

export function clampScore(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  if (n < 1) return null;
  return Math.min(10, n);
}
