import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openDB, reqToPromise, txDone, getStore, getStores, STORE } from "../shared/idb.js";
import { makeThumbnail } from "../shared/image.js";
import { safeImageDataUrl } from "../shared/sanitize.js";
import {
  createRecord,
  normalizeRecord,
  musicYear,
  GOLDMINE_RANK,
  RECORD_STATUS,
} from "./recordSchema.js";

// `cover` argument convention, used by every write below:
//   undefined → leave the stored cover untouched
//   null      → remove the cover
//   data URL  → replace the cover (a thumbnail is derived from it automatically)
const UNCHANGED = undefined;

// ---- Low-level DB operations ----

/**
 * Derive the inline thumbnail from a full cover before any transaction opens —
 * canvas work is async and would let an open IndexedDB transaction auto-commit.
 */
async function prepare(record, cover) {
  const entry = createRecord(record);
  if (cover === UNCHANGED) return { entry, coverOp: "skip" };
  if (cover === null) {
    entry.coverThumbBase64 = null;
    return { entry, coverOp: "delete" };
  }
  const full = safeImageDataUrl(cover);
  if (!full) {
    entry.coverThumbBase64 = null;
    return { entry, coverOp: "delete" };
  }
  entry.coverThumbBase64 = safeImageDataUrl(await makeThumbnail(full));
  return { entry, coverOp: "put", full };
}

export async function dbPutRecord(record, cover = UNCHANGED) {
  const db = await openDB();
  const { entry, coverOp, full } = await prepare(record, cover);

  if (coverOp === "skip") {
    await reqToPromise(getStore(db, STORE.RECORDS, "readwrite").put(entry));
    return entry;
  }

  const { tx, stores } = getStores(db, [STORE.RECORDS, STORE.COVERS], "readwrite");
  stores[STORE.RECORDS].put(entry);
  if (coverOp === "put") stores[STORE.COVERS].put({ id: entry.id, full });
  else stores[STORE.COVERS].delete(entry.id);
  await txDone(tx);
  return entry;
}

/** Record and cover go away together, in one transaction. */
export async function dbDeleteRecord(id) {
  const db = await openDB();
  const { tx, stores } = getStores(db, [STORE.RECORDS, STORE.COVERS], "readwrite");
  stores[STORE.RECORDS].delete(id);
  stores[STORE.COVERS].delete(id);
  await txDone(tx);
}

export async function dbGetRecord(id) {
  const db = await openDB();
  return reqToPromise(getStore(db, STORE.RECORDS).get(id));
}

export async function dbGetAllRecords() {
  const db = await openDB();
  return reqToPromise(getStore(db, STORE.RECORDS).getAll());
}

/** Full-resolution cover for one record, or null. Read by the detail view and export. */
export async function dbGetCover(id) {
  const db = await openDB();
  const row = await reqToPromise(getStore(db, STORE.COVERS).get(id));
  return safeImageDataUrl(row?.full) ?? null;
}

/**
 * Bulk upsert used by import. Accepts records that carry `coverImageBase64`
 * (how a backup file stores the joined cover — see ADR-6) and splits it back out.
 * Returns the number of records written.
 */
export async function dbBulkPutRecords(list) {
  const prepared = [];
  for (const raw of list) {
    const entry = normalizeRecord(raw);
    if (!entry) continue;
    const full = safeImageDataUrl(raw?.coverImageBase64);
    // A hand-made file may carry the full cover but no thumbnail; derive one.
    if (full && !entry.coverThumbBase64) {
      entry.coverThumbBase64 = safeImageDataUrl(await makeThumbnail(full));
    }
    prepared.push({ entry, full });
  }
  if (!prepared.length) return 0;

  const db = await openDB();
  const { tx, stores } = getStores(db, [STORE.RECORDS, STORE.COVERS], "readwrite");
  for (const { entry, full } of prepared) {
    stores[STORE.RECORDS].put(entry);
    if (full) stores[STORE.COVERS].put({ id: entry.id, full });
  }
  await txDone(tx);
  return prepared.length;
}

// ---- Pure filter + sort (client-side, used by the vinyl FilterBar) ----

export const SORT = {
  NEWEST: "newest",
  ARTIST_ASC: "artist-asc",
  TITLE_ASC: "title-asc",
  YEAR_DESC: "year-desc",
  YEAR_ASC: "year-asc",
  RATING_DESC: "rating-desc",
};

const norm = (s) => (s ?? "").toString().toLowerCase().trim();
const cmp = (a, b) => norm(a).localeCompare(norm(b), "no");
const hasAny = (list, term) => (list || []).some((v) => norm(v).includes(norm(term)));

export function filterAndSortRecords(records, filters = {}) {
  const {
    status,
    artist,
    genre,
    style,
    format,
    label,
    decade, // e.g. 1970 → everything from 1970–1979
    condition, // minimum acceptable media grade
    search,
    sort = SORT.NEWEST,
  } = filters;

  const minRank = condition ? GOLDMINE_RANK[condition] : null;

  let out = records.filter((r) => {
    if (status && r.status !== status) return false;
    if (artist && !norm(r.artist).includes(norm(artist))) return false;
    if (label && !norm(r.label).includes(norm(label))) return false;
    if (genre && !hasAny(r.genres, genre)) return false;
    if (style && !hasAny(r.styles, style)) return false;
    if (format && !hasAny(r.formats, format)) return false;
    if (decade) {
      const y = musicYear(r);
      if (y == null || y < decade || y > decade + 9) return false;
    }
    if (minRank != null) {
      const rank = GOLDMINE_RANK[r.mediaCondition];
      if (rank == null || rank > minRank) return false;
    }
    if (search) {
      const q = norm(search);
      const hay = [
        r.artist, r.title, r.label, r.catalogNumber, r.pressingNote, r.myNotes,
        ...(r.genres || []), ...(r.styles || []), ...(r.formats || []),
      ].map(norm).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Unknown years sort last in both directions rather than clumping at one end.
  const byYear = (dir) => (a, b) => {
    const ya = musicYear(a);
    const yb = musicYear(b);
    if (ya == null && yb == null) return cmp(a.artist, b.artist);
    if (ya == null) return 1;
    if (yb == null) return -1;
    return dir === "asc" ? ya - yb : yb - ya;
  };

  out = out.slice().sort((a, b) => {
    switch (sort) {
      case SORT.ARTIST_ASC:
        return cmp(a.artist, b.artist) || (musicYear(a) ?? 0) - (musicYear(b) ?? 0);
      case SORT.TITLE_ASC:
        return cmp(a.title, b.title);
      case SORT.YEAR_DESC:
        return byYear("desc")(a, b);
      case SORT.YEAR_ASC:
        return byYear("asc")(a, b);
      case SORT.RATING_DESC:
        return (b.myRating ?? -1) - (a.myRating ?? -1);
      case SORT.NEWEST:
      default:
        return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
    }
  });

  return out;
}

/** Async DB-backed query, mirroring queryWines. */
export async function queryRecords(filters = {}) {
  return filterAndSortRecords(await dbGetAllRecords(), filters);
}

// ---- React hook ----

export function useRecordDB() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Full covers are large; keep the ones already read this session.
  const coverCache = useRef(new Map());

  const refresh = useCallback(async () => {
    try {
      setRecords(await dbGetAllRecords());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveRecord = useCallback(async (record, cover = UNCHANGED) => {
    const entry = await dbPutRecord(record, cover);
    if (cover !== UNCHANGED) coverCache.current.delete(entry.id);
    setRecords((prev) => {
      const i = prev.findIndex((r) => r.id === entry.id);
      return i === -1 ? [...prev, entry] : prev.map((r) => (r.id === entry.id ? entry : r));
    });
    return entry;
  }, []);

  const addRecord = saveRecord;
  const updateRecord = saveRecord;

  const deleteRecord = useCallback(async (id) => {
    await dbDeleteRecord(id);
    coverCache.current.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRecord = useCallback(
    async (id) => records.find((r) => r.id === id) ?? (await dbGetRecord(id)),
    [records]
  );

  const getCover = useCallback(async (id) => {
    if (coverCache.current.has(id)) return coverCache.current.get(id);
    const full = await dbGetCover(id);
    coverCache.current.set(id, full);
    return full;
  }, []);

  const importRecords = useCallback(async (list) => {
    const count = await dbBulkPutRecords(list);
    coverCache.current.clear();
    await refresh();
    return count;
  }, [refresh]);

  const stats = useMemo(() => {
    const owned = records.filter((r) => r.status === RECORD_STATUS.OWNED);
    const wish = records.filter((r) => r.status === RECORD_STATUS.WISH);
    const spentNOK = owned.reduce((sum, r) => sum + (r.purchasePriceNOK || 0), 0);
    const plays = records.reduce((sum, r) => sum + (r.plays || 0), 0);
    return { total: records.length, owned: owned.length, wish: wish.length, spentNOK, plays };
  }, [records]);

  return {
    records,
    loading,
    error,
    stats,
    refresh,
    addRecord,
    updateRecord,
    saveRecord,
    deleteRecord,
    getRecord,
    getCover,
    importRecords,
  };
}
