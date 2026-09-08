// Backup file format v2 — one file for the whole app (docs/ARCHITECTURE.md, ADR-6).
//
// This module owns both directions. It is the only place that knows what a backup
// file looks like, so the writer and the reader can never drift apart.
//
//   {
//     "app": "vin-og-vinyl",
//     "version": 2,
//     "exportedAt": "2026-09-08T12:00:00.000Z",
//     "wines":   [ /* as in v1 */ ],
//     "records": [ /* with coverImageBase64 joined in from the covers store */ ]
//   }
//
// It sits in shared/ even though it imports both schemas: a backup spans the whole
// app by definition, so there is no collection-neutral place for it. The shared
// *components* rule (ADR-5) is untouched — nothing here renders.

import { openDB, reqToPromise, txDone, getStore, getStores, STORE } from "./idb.js";
import { safeImageDataUrl } from "./sanitize.js";
import { makeThumbnail } from "./image.js";
import { normalizeWine } from "../wine/wineSchema.js";
import { normalizeRecord } from "../vinyl/recordSchema.js";

export const BACKUP_APP = "vin-og-vinyl";
export const BACKUP_VERSION = 2;

const MIME = "application/json;charset=utf-8";

/** Covers read per transaction, and records serialised before the buffer is flushed. */
const BATCH = 20;

/** Wines carry no separate store, so they only need a flush ceiling. */
const WINE_FLUSH = 100;

/**
 * Refuse a file this large before reading it. `file.text()` decodes the whole
 * thing into one JS string and `JSON.parse` builds a second copy of it; a few
 * hundred megabytes of that kills the tab on a phone with no message at all.
 * A real backup of a big shelf — covers included — is a few tens of megabytes.
 */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

/** Thrown by parseBackup and readBackupFile. `code` drives the message the UI shows. */
export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

export function backupFilename(date = new Date()) {
  return `vin-og-vinyl-eksport-${date.toISOString().slice(0, 10)}.json`;
}

// ---- Writing ----

/**
 * Full covers live in their own store (ADR-4), so read them back a batch at a time.
 * Every get() is issued synchronously into the same transaction — awaiting between
 * two requests would let an idle transaction auto-commit.
 */
async function readCovers(db, ids) {
  const store = getStore(db, STORE.COVERS);
  const pairs = await Promise.all(
    ids.map(async (id) => {
      const row = await reqToPromise(store.get(id));
      return [id, safeImageDataUrl(row?.full)];
    })
  );
  return new Map(pairs.filter(([, full]) => full));
}

/**
 * Serialise the whole collection into a Blob without ever holding the finished
 * JSON as one string. A shelf of a few hundred covers is tens of megabytes, and a
 * single JSON.stringify of that can fail outright on a phone (ADR-6).
 *
 * Each entry is stringified on its own and the buffer is folded into the Blob every
 * batch, so the JS heap only ever holds one window of the file at a time — the rest
 * is already in browser-managed (disk-backed) blob storage.
 */
export async function createBackupBlob({ wines = [], records = [] } = {}) {
  let blob = new Blob([], { type: MIME });
  let parts = [];

  const flush = () => {
    if (!parts.length) return;
    blob = new Blob([blob, ...parts], { type: MIME });
    parts = [];
  };

  parts.push(
    "{\n" +
      `  "app": ${JSON.stringify(BACKUP_APP)},\n` +
      `  "version": ${BACKUP_VERSION},\n` +
      `  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n` +
      '  "wines": ['
  );

  wines.forEach((wine, i) => {
    parts.push(`${i ? "," : ""}\n    ${JSON.stringify(wine)}`);
    if (parts.length >= WINE_FLUSH) flush();
  });

  parts.push('\n  ],\n  "records": [');
  flush();

  const db = records.length ? await openDB() : null;
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    const covers = await readCovers(db, slice.map((r) => r.id));
    slice.forEach((record, j) => {
      const full = covers.get(record.id);
      // The file is meant to be self-contained: join the full cover back in, but
      // only when there is one, so coverless records cost nothing.
      const entry = full ? { ...record, coverImageBase64: full } : record;
      parts.push(`${i + j ? "," : ""}\n    ${JSON.stringify(entry)}`);
    });
    flush();
  }

  parts.push("\n  ]\n}\n");
  flush();
  return blob;
}

/** Hands the blob to the browser as a download. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  // Firefox only follows the click when the anchor is in the document.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A large blob must stay alive until the download has actually started.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Export both collections to a downloaded file. Returns the filename. */
export async function exportBackup({ wines, records }) {
  const filename = backupFilename();
  saveBlob(await createBackupBlob({ wines, records }), filename);
  return filename;
}

// ---- Reading ----

/**
 * Recognise a backup file and hand back the two raw lists. Nothing is sanitised
 * here — importBackup does that, so a caller cannot skip it by accident.
 *
 * v2  → both collections.
 * v1  → a bare array, or `{ wines: [...] }` with no version. Wines only.
 * v3+ → rejected outright rather than half-read.
 */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("invalid_json");
  }

  let version = 1;
  let wines = [];
  let records = [];

  if (Array.isArray(parsed)) {
    wines = parsed; // oldest shape: the wine array on its own
  } else if (parsed && typeof parsed === "object") {
    version = Number.isFinite(+parsed.version) ? Math.trunc(+parsed.version) : 1;
    if (version > BACKUP_VERSION) throw new BackupError("future_version");
    if (Array.isArray(parsed.wines)) wines = parsed.wines;
    // v1 had no records; anything calling itself one in a v1 file is not ours.
    if (version >= 2 && Array.isArray(parsed.records)) records = parsed.records;
  } else {
    throw new BackupError("not_a_backup");
  }

  if (!wines.length && !records.length) throw new BackupError("empty");
  return { version, wines, records };
}

export async function readBackupFile(file) {
  if (file?.size > MAX_BACKUP_BYTES) throw new BackupError("too_large");
  return parseBackup(await file.text());
}

/**
 * Write both collections in a single transaction over wines, records and covers
 * (ADR-3), so a file that turns out to be corrupt halfway cannot leave the app in
 * a half-imported state. Merging is upsert on `id`.
 *
 * Everything async — normalising, and deriving a missing thumbnail on a canvas —
 * happens before the transaction opens, for the same auto-commit reason as above.
 */
export async function importBackup({ wines = [], records = [] } = {}) {
  const wineEntries = [];
  for (const raw of wines) {
    const wine = normalizeWine(raw);
    if (wine) wineEntries.push(wine);
  }

  const recordEntries = [];
  for (const raw of records) {
    const entry = normalizeRecord(raw);
    if (!entry) continue;
    const full = safeImageDataUrl(raw?.coverImageBase64);
    // A hand-edited file may carry the full cover but no thumbnail; derive one.
    if (full && !entry.coverThumbBase64) {
      try {
        entry.coverThumbBase64 = safeImageDataUrl(await makeThumbnail(full));
      } catch {
        // A cover we cannot decode is not worth losing the record over.
      }
    }
    recordEntries.push({ entry, full });
  }

  if (!wineEntries.length && !recordEntries.length) return { wines: 0, records: 0 };

  const db = await openDB();
  const { tx, stores } = getStores(
    db,
    [STORE.WINES, STORE.RECORDS, STORE.COVERS],
    "readwrite"
  );
  // put() throws synchronously on a value IndexedDB cannot store (a structured-clone
  // failure, or a key type it rejects). Without the abort, that throw would escape
  // with writes already queued — and those queued writes still commit, which is
  // exactly the half-imported state the single transaction exists to prevent.
  try {
    for (const wine of wineEntries) stores[STORE.WINES].put(wine);
    for (const { entry, full } of recordEntries) {
      stores[STORE.RECORDS].put(entry);
      // Overwriting a record replaces its cover too — otherwise an imported record
      // without cover art would keep the full image of whatever it replaced.
      if (full) stores[STORE.COVERS].put({ id: entry.id, full });
      else stores[STORE.COVERS].delete(entry.id);
    }
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already aborted or committed — nothing left to undo */
    }
    throw e;
  }
  await txDone(tx);

  return { wines: wineEntries.length, records: recordEntries.length };
}

/** Read a picked file and write it, in one call. Throws BackupError on a bad file. */
export async function importBackupFile(file) {
  const { version, wines, records } = await readBackupFile(file);
  const counts = await importBackup({ wines, records });
  return { ...counts, version };
}
