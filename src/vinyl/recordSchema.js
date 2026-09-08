// Field definitions for one vinyl record. Single source of truth for the data model.
//
// STUB — Phase 1 only locks the enums that ADR-7 decided. `createRecord`,
// `normalizeRecord`, `RECORD_KEYS` and `clampRating` are written in Phase 2,
// following docs/ARCHITECTURE.md (ADR-4 for cover fields, ADR-7 for conventions).
//
// "record" always means a vinyl release. A row in IndexedDB is an "entry".

// eslint-disable-next-line no-unused-vars
import { safeExternalUrl, safeImageDataUrl } from "../shared/sanitize.js";

/** Stored values are English; Norwegian lives in the UI label map only. */
export const RECORD_STATUS = {
  OWNED: "owned",
  WISH: "wishlist",
};

export const RECORD_STATUS_LABEL = {
  [RECORD_STATUS.OWNED]: "Eier",
  [RECORD_STATUS.WISH]: "Ønskeliste",
};

/** Goldmine grading, canonical notation. Used for media and sleeve independently. */
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

export const RECORD_FORMATS = [
  "LP", "2xLP", "3xLP", "Box", "12\"", "10\"", "7\"",
  "Picture Disc", "Coloured", "Gatefold", "180g", "45 RPM",
];

// TODO Phase 2: createRecord(), normalizeRecord(), RECORD_KEYS, clampRating().
