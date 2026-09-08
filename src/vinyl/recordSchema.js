// Field definitions for one vinyl record. Single source of truth for the data model.
//
// "record" always means a vinyl release. A row in IndexedDB is an "entry".
// Stored enum values are English; Norwegian appears only in the UI label maps
// (docs/ARCHITECTURE.md, ADR-7).

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

export const RECORD_STATUS = {
  OWNED: "owned",
  WISH: "wishlist",
};

export const RECORD_STATUS_LABEL = {
  [RECORD_STATUS.OWNED]: "Eier",
  [RECORD_STATUS.WISH]: "Ønskeliste",
};

/** Goldmine grading, canonical notation, best first. Media and sleeve are graded apart. */
export const GOLDMINE = ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"];

export const GOLDMINE_LABEL = {
  "M": "Mint (M)",
  "NM": "Near Mint (NM)",
  "VG+": "Very Good Plus (VG+)",
  "VG": "Very Good (VG)",
  "G+": "Good Plus (G+)",
  "G": "Good (G)",
  "F": "Fair (F)",
  "P": "Poor (P)",
};

/** Lower rank is a better copy — lets "at least VG+" be a simple comparison. */
export const GOLDMINE_RANK = Object.fromEntries(GOLDMINE.map((g, i) => [g, i]));

/** Suggestions for the format picker. Free text is still allowed — Discogs has many more. */
export const RECORD_FORMATS = [
  "LP", "2xLP", "3xLP", "Box", "12\"", "10\"", "7\"",
  "Picture Disc", "Coloured", "Gatefold", "180g", "45 RPM",
];

const YEAR_MIN = 1880; // earlier than any pressing anyone is likely to shelve
const yearMax = () => new Date().getFullYear() + 1;

export function clampRating(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(10, n);
}

export function clampYear(v) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < YEAR_MIN || n > yearMax()) return null;
  return n;
}

/** Bounded on both axes: an import file must not be able to define 10 000 genres. */
const MAX_LIST = 32;
const MAX_LIST_ITEM = 100;

function stringList(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const trimmed = item.slice(0, MAX_LIST_ITEM).trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function grade(v) {
  return GOLDMINE.includes(v) ? v : null;
}

/**
 * Returns a fresh, fully-shaped record. Every persisted record has exactly these
 * keys, with exactly these types, so queries and indexes stay stable.
 *
 * Every field is coerced here rather than in normalizeRecord: this is the single
 * gate every write passes through — `dbPutRecord` calls it directly — so a field
 * validated only in normalizeRecord would still be reachable from the UI path.
 *
 * Cover art is split: the thumbnail lives here, the full-resolution image lives in
 * the separate `covers` store and is never a field on the record (ADR-4).
 */
export function createRecord(partial = {}) {
  return {
    id: safeId(partial.id),
    status: partial.status === RECORD_STATUS.WISH ? RECORD_STATUS.WISH : RECORD_STATUS.OWNED,
    addedAt: safeIsoDate(partial.addedAt, new Date().toISOString()),
    acquiredAt: safeIsoDate(partial.acquiredAt),

    // From Discogs or manual entry
    artist: safeText(partial.artist, 300),
    title: safeText(partial.title, 300),
    releaseYear: clampYear(partial.releaseYear), // this pressing
    originalYear: clampYear(partial.originalYear), // first release of the music
    label: safeText(partial.label, 200),
    catalogNumber: safeText(partial.catalogNumber, 100),
    formats: stringList(partial.formats),
    pressingNote: safeText(partial.pressingNote),
    country: safeText(partial.country, 100),
    genres: stringList(partial.genres),
    styles: stringList(partial.styles),
    discogsId: safeNumber(partial.discogsId, { min: 1, integer: true }),
    discogsUrl: safeExternalUrl(partial.discogsUrl),
    barcode: safeTextOrNull(partial.barcode, 32),
    coverThumbBase64: safeImageDataUrl(partial.coverThumbBase64),

    // Condition
    mediaCondition: grade(partial.mediaCondition),
    sleeveCondition: grade(partial.sleeveCondition),
    conditionNotes: safeText(partial.conditionNotes),

    // User fields
    myRating: clampRating(partial.myRating), // 1–10
    myNotes: safeText(partial.myNotes),

    // Purchase
    purchasePriceNOK: safeNumber(partial.purchasePriceNOK, { min: 0, max: 1e9 }),
    purchaseDate: safeText(partial.purchaseDate, 40),
    purchasePlace: safeText(partial.purchasePlace, 200),

    // Shelf
    storageLocation: safeText(partial.storageLocation, 200),
    plays: safeCount(partial.plays),
    estimatedValueNOK: safeNumber(partial.estimatedValueNOK, { min: 0, max: 1e9 }),
  };
}

// Keys that must never be lost on update/import merge.
export const RECORD_KEYS = Object.keys(createRecord());

/**
 * Coerce an arbitrary (imported/parsed) object into a valid record, or reject it.
 * The field-by-field coercion lives in createRecord; this only adds the rule that
 * an import must not create empty rows.
 */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = createRecord(raw);
  // A record with neither artist nor title is not worth storing.
  if (!record.artist && !record.title) return null;
  return record;
}

/** The year a listener thinks of the music as being from. */
export function musicYear(record) {
  return record.originalYear ?? record.releaseYear ?? null;
}

/** "Artist – Title", for lists and sorting fallbacks. */
export function recordLabel(record) {
  return [record.artist, record.title].filter(Boolean).join(" – ") || "Uten tittel";
}
