import { useCallback, useRef, useState } from "react";
import { proxyJson, proxyBlob } from "../shared/proxyClient.js";
import { compressImage, COVER_MAX_WIDTH } from "../shared/image.js";

/**
 * Discogs lookups. The token lives in the Cloudflare Worker, never here, and the
 * proxy trims every response to a fixed field list before it reaches us — see the
 * header comment in cloudflare-worker.js.
 *
 * Flow the UI is built around: search returns hits whose `title` is Discogs' combined
 * "Artist - Title" string, the user picks one, and `getRelease(id)` then supplies
 * properly separated fields. Cover art is fetched separately, once, on selection —
 * search results carry no images, which keeps 25 hits to a single request.
 */

/** Discogs search hits combine artist and title. Split on the first " - " only. */
export function splitCombinedTitle(combined) {
  const s = (combined || "").trim();
  const i = s.indexOf(" - ");
  if (i === -1) return { artist: "", title: s };
  return { artist: s.slice(0, i).trim(), title: s.slice(i + 3).trim() };
}

/** Map a proxy release (or search hit) onto the fields recordSchema understands. */
export function mapReleaseToRecord(release) {
  if (!release || typeof release !== "object") return null;
  const { artist, title } = release.artist
    ? { artist: release.artist, title: release.title }
    : splitCombinedTitle(release.title);

  return {
    artist,
    title,
    releaseYear: release.year ?? null,
    // Discogs puts the original release year on the master, which is a separate
    // lookup. Left for the user to fill in rather than guessed at.
    originalYear: null,
    label: release.label ?? "",
    catalogNumber: release.catalogNumber ?? "",
    formats: Array.isArray(release.formats) ? release.formats : [],
    country: release.country ?? "",
    genres: Array.isArray(release.genres) ? release.genres : [],
    styles: Array.isArray(release.styles) ? release.styles : [],
    discogsId: release.id ?? null,
    discogsUrl: release.id ? `https://www.discogs.com/release/${release.id}` : null,
    barcode: release.barcode ?? null,
  };
}

/** Short label for a search hit in the result list. */
export function hitSummary(hit) {
  return [hit.year, hit.country, hit.label, (hit.formats || []).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

export function useDiscogs() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const runSearch = useCallback(async (path, params) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const data = await proxyJson(path, params, ctrl.signal);
      const hits = Array.isArray(data?.results) ? data.results : [];
      setResults(hits);
      return hits;
    } catch (e) {
      if (e.name === "AbortError") return [];
      setError(e);
      setResults([]);
      return [];
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  const search = useCallback((term) => runSearch("discogs/search", { q: term }), [runSearch]);

  const lookupByBarcode = useCallback(
    (ean) => runSearch("discogs/barcode", { ean }),
    [runSearch]
  );

  /** One release, with artist and title already separated by the proxy. */
  const getRelease = useCallback(async (id) => {
    setError(null);
    try {
      return await proxyJson(`discogs/release/${encodeURIComponent(id)}`);
    } catch (e) {
      setError(e);
      return null;
    }
  }, []);

  /**
   * Cover art, downscaled and ready to hand to useRecordDB.saveRecord().
   * Returns null when the release has no image — that is not an error.
   */
  const getCover = useCallback(async (id) => {
    try {
      const blob = await proxyBlob(`discogs/cover/${encodeURIComponent(id)}`);
      return await compressImage(blob, COVER_MAX_WIDTH);
    } catch (e) {
      if (e.code === 404) return null;
      setError(e);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { results, loading, error, search, lookupByBarcode, getRelease, getCover, clear };
}
