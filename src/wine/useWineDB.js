import { useCallback, useEffect, useMemo, useState } from "react";
import { createWine } from "./wineSchema.js";
import { openDB, reqToPromise, getStore, STORE } from "../shared/idb.js";

// The database itself is owned by src/shared/idb.js — name, version and upgrade
// ladder live there so the wine and vinyl hooks can never disagree (ADR-3).
const tx = (db, mode) => getStore(db, STORE.WINES, mode);

// ---- Low-level DB operations ----

export async function dbAddWine(wine) {
  const db = await openDB();
  const record = createWine(wine); // ensure full shape
  await reqToPromise(tx(db, "readwrite").put(record));
  return record;
}

export async function dbUpdateWine(wine) {
  const db = await openDB();
  const record = createWine(wine);
  await reqToPromise(tx(db, "readwrite").put(record));
  return record;
}

export async function dbDeleteWine(id) {
  const db = await openDB();
  await reqToPromise(tx(db, "readwrite").delete(id));
}

export async function dbGetWine(id) {
  const db = await openDB();
  return reqToPromise(tx(db, "readonly").get(id));
}

export async function dbGetAllWines() {
  const db = await openDB();
  return reqToPromise(tx(db, "readonly").getAll());
}

// ---- Pure filter + sort (client-side, used by FilterBar) ----

export const SORT = {
  SCORE_DESC: "score-desc",
  NEWEST: "newest",
  PRICE_ASC: "price-asc",
  NAME_ASC: "name-asc",
};

const norm = (s) => (s ?? "").toString().toLowerCase().trim();

export function filterAndSortWines(wines, filters = {}) {
  const {
    status,
    type,
    country,
    region,
    grape,
    producer,
    supplier,
    wantAgain,
    search,
    sort = SORT.NEWEST,
  } = filters;

  let out = wines.filter((w) => {
    if (status && w.status !== status) return false;
    if (type && w.type !== type) return false;
    if (wantAgain && !w.wantAgain) return false;
    if (country && !norm(w.country).includes(norm(country))) return false;
    if (region && !(norm(w.region).includes(norm(region)) || norm(w.subregion).includes(norm(region)))) return false;
    if (producer && !norm(w.producer).includes(norm(producer))) return false;
    if (supplier && !norm(w.supplier).includes(norm(supplier))) return false;
    if (grape && !w.grapes.some((g) => norm(g).includes(norm(grape)))) return false;
    if (search) {
      const q = norm(search);
      const hay = [w.name, w.producer, w.region, w.subregion, w.myNotes, ...(w.grapes || [])]
        .map(norm)
        .join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  out = out.slice().sort((a, b) => {
    switch (sort) {
      case SORT.SCORE_DESC:
        return (b.myScore ?? -1) - (a.myScore ?? -1);
      case SORT.PRICE_ASC:
        return (a.priceNOK ?? Infinity) - (b.priceNOK ?? Infinity);
      case SORT.NAME_ASC:
        return norm(a.name).localeCompare(norm(b.name), "no");
      case SORT.NEWEST:
      default:
        return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
    }
  });

  return out;
}

/** Async DB-backed query (uses status index, filters/sorts the rest). */
export async function queryWines(filters = {}) {
  const all = await dbGetAllWines();
  return filterAndSortWines(all, filters);
}

// ---- React hook ----

export function useWineDB() {
  const [wines, setWines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const all = await dbGetAllWines();
      setWines(all);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWine = useCallback(async (wine) => {
    const rec = await dbAddWine(wine);
    setWines((prev) => [...prev, rec]);
    return rec;
  }, []);

  const updateWine = useCallback(async (wine) => {
    const rec = await dbUpdateWine(wine);
    setWines((prev) => prev.map((w) => (w.id === rec.id ? rec : w)));
    return rec;
  }, []);

  const deleteWine = useCallback(async (id) => {
    await dbDeleteWine(id);
    setWines((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const getWine = useCallback(
    async (id) => wines.find((w) => w.id === id) ?? (await dbGetWine(id)),
    [wines]
  );

  const stats = useMemo(() => {
    const tasted = wines.filter((w) => w.status === "smakt");
    const wish = wines.filter((w) => w.status === "ønske");
    const bottles = tasted.reduce((sum, w) => sum + (w.quantity || 0), 0);
    return { total: wines.length, tasted: tasted.length, wish: wish.length, bottles };
  }, [wines]);

  return {
    wines,
    loading,
    error,
    stats,
    refresh,
    addWine,
    updateWine,
    deleteWine,
    getWine,
  };
}
