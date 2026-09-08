// Field definitions for one vinyl record. Single source of truth for the data model.
//
// "record" always means a vinyl release. A row in IndexedDB is an "entry".
// Stored enum values are English; Norwegian appears only in the UI label maps
// (docs/ARCHITECTURE.md, ADR-7).

import { safeExternalUrl, safeImageDataUrl } from "../shared/sanitize.js";

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

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stringList(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function grade(v) {
  return GOLDMINE.includes(v) ? v : null;
}

/**
 * Returns a fresh, fully-shaped record. Every persisted record has exactly these
 * keys so queries and indexes stay stable.
 *
 * Cover art is split: the thumbnail lives here, the full-resolution image lives in
 * the separate `covers` store and is never a field on the record (ADR-4).
 */
export function createRecord(partial = {}) {
  return {
    id: partial.id ?? crypto.randomUUID(),
    status: partial.status ?? RECORD_STATUS.OWNED,
    addedAt: partial.addedAt ?? new Date().toISOString(),
    acquiredAt: partial.acquiredAt ?? null,

    // From Discogs or manual entry
    artist: partial.artist ?? "",
    title: partial.title ?? "",
    releaseYear: partial.releaseYear ?? null, // this pressing
    originalYear: partial.originalYear ?? null, // first release of the music
    label: partial.label ?? "",
    catalogNumber: partial.catalogNumber ?? "",
    formats: partial.formats ?? [],
    pressingNote: partial.pressingNote ?? "",
    country: partial.country ?? "",
    genres: partial.genres ?? [],
    styles: partial.styles ?? [],
    discogsId: partial.discogsId ?? null,
    discogsUrl: safeExternalUrl(partial.discogsUrl),
    barcode: partial.barcode ?? null,
    coverThumbBase64: safeImageDataUrl(partial.coverThumbBase64),

    // Condition
    mediaCondition: partial.mediaCondition ?? null,
    sleeveCondition: partial.sleeveCondition ?? null,
    conditionNotes: partial.conditionNotes ?? "",

    // User fields
    myRating: partial.myRating ?? null, // 1–10
    myNotes: partial.myNotes ?? "",

    // Purchase
    purchasePriceNOK: partial.purchasePriceNOK ?? null,
    purchaseDate: partial.purchaseDate ?? "",
    purchasePlace: partial.purchasePlace ?? "",

    // Shelf
    storageLocation: partial.storageLocation ?? "",
    plays: partial.plays ?? 0,
    estimatedValueNOK: partial.estimatedValueNOK ?? null,
  };
}

// Keys that must never be lost on update/import merge.
export const RECORD_KEYS = Object.keys(createRecord());

/** Coerce an arbitrary (imported/parsed) object into a valid record. */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const record = createRecord(raw);

  record.status = raw.status === RECORD_STATUS.WISH ? RECORD_STATUS.WISH : RECORD_STATUS.OWNED;
  record.artist = typeof raw.artist === "string" ? raw.artist.trim() : "";
  record.title = typeof raw.title === "string" ? raw.title.trim() : "";
  record.releaseYear = clampYear(raw.releaseYear);
  record.originalYear = clampYear(raw.originalYear);
  record.formats = stringList(raw.formats);
  record.genres = stringList(raw.genres);
  record.styles = stringList(raw.styles);
  record.discogsId = Number.isFinite(+raw.discogsId) && +raw.discogsId > 0 ? Math.trunc(+raw.discogsId) : null;
  record.barcode = typeof raw.barcode === "string" && raw.barcode.trim() ? raw.barcode.trim() : null;

  record.mediaCondition = grade(raw.mediaCondition);
  record.sleeveCondition = grade(raw.sleeveCondition);
  record.myRating = clampRating(raw.myRating);

  record.purchasePriceNOK = numOrNull(raw.purchasePriceNOK);
  record.estimatedValueNOK = numOrNull(raw.estimatedValueNOK);
  record.plays = Number.isFinite(+raw.plays) ? Math.max(0, Math.trunc(+raw.plays)) : 0;

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
