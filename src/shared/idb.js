// Shared IndexedDB access.
//
// This module owns the database name, the version number and the whole upgrade
// ladder. No hook opens the database on its own — two openers with different
// version constants would race, and whichever loaded first would decide whether
// the other got a VersionError or a blocked upgrade. See docs/ARCHITECTURE.md (ADR-3).

// Internal key only, never shown to the user. Deliberately still the old name so
// existing installs keep their data — see docs/PLAN.md.
const DB_NAME = "vinkjeller-db";
const DB_VERSION = 2;

export const STORE = {
  WINES: "wines",
  RECORDS: "records",
  COVERS: "covers",
};

let dbPromise = null;

/** v0 → v1. Never change this: it must produce the same shape an old install already has. */
function createWineStore(db) {
  const store = db.createObjectStore(STORE.WINES, { keyPath: "id" });
  store.createIndex("status", "status", { unique: false });
  store.createIndex("country", "country", { unique: false });
  store.createIndex("region", "region", { unique: false });
  store.createIndex("grapes", "grapes", { unique: false, multiEntry: true });
  store.createIndex("type", "type", { unique: false });
  store.createIndex("myScore", "myScore", { unique: false });
  store.createIndex("wantAgain", "wantAgain", { unique: false });
  store.createIndex("addedAt", "addedAt", { unique: false });
}

/**
 * v1 → v2. Adds the vinyl collection. Indexes are deliberately minimal: the read
 * path is getAll() + filtering in memory, so extra indexes would only cost on write.
 */
function createRecordStores(db) {
  const records = db.createObjectStore(STORE.RECORDS, { keyPath: "id" });
  records.createIndex("status", "status", { unique: false });
  records.createIndex("addedAt", "addedAt", { unique: false });
  records.createIndex("artist", "artist", { unique: false });
  records.createIndex("discogsId", "discogsId", { unique: false });

  // Full-resolution cover art, keyed by record id. Kept out of the record itself so
  // getAll() stays cheap — the record carries only a small thumbnail (ADR-4).
  db.createObjectStore(STORE.COVERS, { keyPath: "id" });
}

/**
 * Each step is independent and guarded, so any starting version lands on the same
 * shape and re-running a step is harmless.
 */
function upgrade(db, oldVersion) {
  if (oldVersion < 1 && !db.objectStoreNames.contains(STORE.WINES)) {
    createWineStore(db);
  }
  if (oldVersion < 2 && !db.objectStoreNames.contains(STORE.RECORDS)) {
    createRecordStores(db);
  }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => upgrade(req.result, event.oldVersion);

    req.onsuccess = () => {
      const db = req.result;
      // Another tab wants to upgrade: let go of our connection instead of blocking it.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onblocked = () => {
      dbPromise = null;
      const err = new Error("idb_blocked");
      err.code = "blocked";
      reject(err);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Test hook: drop the cached connection so the next openDB() reopens from scratch. */
export function resetDBCache() {
  dbPromise = null;
}

export function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolves when the transaction commits, rejects if it aborts or errors. */
export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("tx_aborted"));
    tx.onerror = () => reject(tx.error);
  });
}

/** One store, one transaction. */
export function getStore(db, name, mode = "readonly") {
  return db.transaction(name, mode).objectStore(name);
}

/**
 * Several stores in a single transaction — the reason both collections live in one
 * database. Returns the transaction plus each store by name.
 */
export function getStores(db, names, mode = "readonly") {
  const tx = db.transaction(names, mode);
  const stores = {};
  for (const name of names) stores[name] = tx.objectStore(name);
  return { tx, stores };
}
