import { useCallback, useRef, useState } from "react";
import { proxyJson } from "../shared/proxyClient.js";

/**
 * Vinmonopolet's public "details-normal" endpoint only returns an index —
 * productId, productShortName and lastChanged — verified empirically against
 * the live API. No producer, price, country, alcohol, grapes, etc. are
 * available at this tier. Search is therefore a name lookup that prefills
 * only name + a link to the product's own page on vinmonopolet.no, where
 * the user reads off the rest and fills it in manually.
 */
export function mapProduct(p) {
  if (!p || typeof p !== "object") return null;
  const id = p?.basic?.productId ?? null;
  const name = p?.basic?.productShortName ?? "";
  if (!id && !name) return null;
  return {
    vinmonopoletId: id,
    name,
    vinmonopoletUrl: id ? `https://www.vinmonopolet.no/p/${encodeURIComponent(id)}` : null,
  };
}

/** Extract the product array from whatever shape the API/proxy returns. */
function extractProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (data && typeof data === "object" && data.basic) return [data];
  return [];
}

export function useVinmonopolet() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (path, params) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const data = await proxyJson(path, params, ctrl.signal);
      const mapped = extractProducts(data)
        .map((p) => mapProduct(p))
        .filter(Boolean);
      setResults(mapped);
      return mapped;
    } catch (e) {
      if (e.name === "AbortError") return [];
      setError(e);
      setResults([]);
      return [];
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  const search = useCallback((term) => run("search", { q: term }), [run]);
  const lookupBarcode = useCallback((ean) => run("barcode", { ean }), [run]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { results, loading, error, search, lookupBarcode, clear };
}
