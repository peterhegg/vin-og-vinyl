/**
 * Vin og vinyl proxy — hides upstream API keys, adds CORS, and keeps the browser
 * from ever talking to Vinmonopolet or Discogs directly.
 *
 * Secrets (set with `wrangler secret put ...`):
 *   VINMONOPOLET_KEY   Ocp-Apim-Subscription-Key from developer.vinmonopolet.no
 *   DISCOGS_TOKEN      personal access token from discogs.com/settings/developers
 *   CLIENT_TOKEN       shared secret; must equal the client's VITE_APP_TOKEN
 *
 * Vars (wrangler.toml [vars]):
 *   ALLOWED_ORIGINS    comma-separated list of allowed browser origins
 *
 * Client calls, all with header  Authorization: Bearer <CLIENT_TOKEN>:
 *   GET /search?q=<term>            → Vinmonopolet name search
 *   GET /barcode?ean=<ean>          → Vinmonopolet (see note on the route)
 *   GET /discogs/search?q=<term>    → Discogs release search    → { results: [...] }
 *   GET /discogs/barcode?ean=<ean>  → Discogs barcode search    → { results: [...] }
 *   GET /discogs/release/<id>       → one release, trimmed      → { ... }
 *   GET /discogs/cover/<id>         → the release's cover art as image bytes
 *
 * Security notes for the Discogs routes:
 *   - The client never supplies a URL. It supplies a release id, and every upstream
 *     URL is built here from validated digits. No code path fetches a client-controlled
 *     address, so the proxy cannot be turned into an open relay.
 *   - Cover art is fetched from the image URL that *Discogs itself* returned, and only
 *     after the host is checked against an allowlist, the scheme is https and redirects
 *     are refused — two independent controls, in case Discogs ever serves a URL off
 *     its own CDN.
 *   - DISCOGS_TOKEN goes to api.discogs.com and nowhere else: never to the CDN, never
 *     back to the client, never inside an error body.
 *   - Upstream responses are projected onto a fixed field list before they reach the
 *     client. Nothing unexpected from Discogs is forwarded, and a release response
 *     drops from ~150 kB to ~1 kB.
 */

const VINMONOPOLET_UPSTREAM = "https://apis.vinmonopolet.no/products/v0/details-normal";
const DISCOGS_API = "https://api.discogs.com";

// Discogs serves all release imagery from these hosts.
const DISCOGS_IMAGE_HOSTS = new Set(["i.discogs.com", "img.discogs.com", "st.discogs.com"]);

// Discogs rejects requests without a descriptive User-Agent.
const USER_AGENT = "VinOgVinyl/1.0 (+https://github.com/peterhegg/vin-og-vinyl)";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const API_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 12000;

// Discogs allows 60 authenticated requests per minute in total, so for a personal app
// the per-IP budget is effectively a global one. Images get a tighter budget of their own.
// The `auth` bucket covers requests that never got past the token gate. Without it,
// anyone who learns the Worker URL can burn the account's request quota for free,
// because the token check returns before any budget is consulted.
const RATE_LIMITS = { api: 60, img: 30, auth: 20 };

const CACHE_SECONDS = { search: 3600, release: 86400, cover: 2592000 };

// ---------------------------------------------------------------- CORS & responses

function corsHeaders(origin, allowed) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // No allowlist configured (local development): stay permissive.
  if (!allowed.length) headers["Access-Control-Allow-Origin"] = "*";
  else if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  // Otherwise no ACAO header at all — the browser blocks it, which is the point.
  return headers;
}

function json(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      ...cors,
      ...extra,
    },
  });
}

// ---------------------------------------------------------------- input validation

// Release ids are constrained to digits by the route patterns further down.
const isEan = (v) => /^\d{8,14}$/.test(v);

/** Free-text query: trimmed, length-capped, no control characters. */
function cleanQuery(raw) {
  const q = (raw || "").trim();
  if (!q || q.length > 100) return null;
  if (/[\u0000-\u001f\u007f]/.test(q)) return null;
  return q;
}

// ---------------------------------------------------------------- rate limiting

/**
 * Approximate per-IP budget. KV is eventually consistent and read-then-write races,
 * so this caps abuse rather than enforcing an exact number. No-op if KV is unbound.
 */
async function overRateLimit(env, ip, bucket) {
  if (!env.RATE_LIMIT_KV) return false;
  const key = `rl:${bucket}:${ip}`;
  const count = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (count >= RATE_LIMITS[bucket]) return true;
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 60 });
  return false;
}

// ---------------------------------------------------------------- Discogs helpers

function discogsFetch(path, env) {
  return fetch(`${DISCOGS_API}${path}`, {
    headers: {
      Authorization: `Discogs token=${env.DISCOGS_TOKEN}`,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

const dedupe = (list) => [...new Set(list.filter((v) => typeof v === "string" && v.trim()))];

/** Discogs disambiguates duplicate artist names with a trailing "(2)". */
const cleanName = (name) => (name || "").replace(/\s*\(\d+\)\s*$/, "").trim();

/** "Talk Talk", or "Ella Fitzgerald & Louis Armstrong" when Discogs supplies join words. */
function joinArtists(artists) {
  if (!Array.isArray(artists)) return "";
  let out = "";
  artists.forEach((a, i) => {
    out += cleanName(a?.anv || a?.name);
    const join = (a?.join || "").trim();
    if (i < artists.length - 1) out += join ? ` ${join} ` : ", ";
  });
  return out.trim().replace(/[,\s]+$/, "");
}

/** Turn Discogs' nested format objects into flat labels a person would write down. */
function releaseFormats(formats) {
  const out = [];
  for (const f of formats || []) {
    const descriptions = Array.isArray(f?.descriptions) ? f.descriptions : [];
    const countable = descriptions.find((d) => /^(LP|EP|Single|12"|10"|7")$/i.test(d)) || f?.name;
    const qty = parseInt(f?.qty, 10);
    if (countable) out.push(Number.isFinite(qty) && qty > 1 ? `${qty}x${countable}` : countable);
    for (const d of descriptions) if (d !== countable) out.push(d);
    if (f?.text) out.push(f.text);
  }
  return dedupe(out).slice(0, 12);
}

function firstBarcode(identifiers) {
  if (!Array.isArray(identifiers)) return null;
  for (const i of identifiers) {
    if (String(i?.type || "").toLowerCase() !== "barcode") continue;
    const digits = String(i?.value || "").replace(/\D/g, "");
    if (isEan(digits)) return digits;
  }
  return null;
}

const asYear = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1880 && n <= 2100 ? n : null;
};

/** Fixed projection of one release. Everything the client sees comes from this list. */
function projectRelease(r) {
  const label = Array.isArray(r?.labels) ? r.labels[0] : null;
  return {
    id: Number(r?.id) || null,
    masterId: Number(r?.master_id) || null,
    artist: joinArtists(r?.artists),
    title: typeof r?.title === "string" ? r.title.trim() : "",
    year: asYear(r?.year),
    country: typeof r?.country === "string" ? r.country : "",
    label: cleanName(label?.name),
    catalogNumber: typeof label?.catno === "string" && label.catno !== "none" ? label.catno : "",
    formats: releaseFormats(r?.formats),
    genres: dedupe(r?.genres || []).slice(0, 8),
    styles: dedupe(r?.styles || []).slice(0, 8),
    barcode: firstBarcode(r?.identifiers),
    hasImage: Array.isArray(r?.images) && r.images.length > 0,
  };
}

/** Search hits have a flatter shape than releases; project them onto their own list. */
function projectSearchHit(h) {
  return {
    id: Number(h?.id) || null,
    masterId: Number(h?.master_id) || null,
    // Discogs returns search titles as "Artist - Title". The client splits it only for
    // display and reads the clean fields from the release lookup that follows.
    title: typeof h?.title === "string" ? h.title.trim() : "",
    year: asYear(h?.year),
    country: typeof h?.country === "string" ? h.country : "",
    label: Array.isArray(h?.label) ? cleanName(h.label[0]) : "",
    catalogNumber: typeof h?.catno === "string" && h.catno !== "none" ? h.catno : "",
    formats: dedupe(h?.format || []).slice(0, 8),
    hasImage: Boolean(h?.cover_image),
  };
}

function upstreamFailure(res, cors) {
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    return json({ error: "upstream_rate_limited" }, 429, cors, retryAfter ? { "Retry-After": retryAfter } : {});
  }
  if (res.status === 404) return json({ error: "not_found" }, 404, cors);
  if (res.status === 401 || res.status === 403) return json({ error: "upstream_auth" }, 502, cors);
  return json({ error: "upstream_error", status: res.status }, 502, cors);
}

// ---------------------------------------------------------------- cover art

/**
 * Fetch the cover for a release. The image URL is never supplied by the client: it is
 * read out of the release Discogs just returned, then checked against the host
 * allowlist. Redirects are refused so an allowlisted host cannot bounce us elsewhere.
 */
async function fetchCover(id, env, cors) {
  const meta = await discogsFetch(`/releases/${id}`, env);
  if (!meta.ok) return upstreamFailure(meta, cors);

  const release = await meta.json();
  const images = Array.isArray(release?.images) ? release.images : [];
  const chosen = images.find((i) => i?.type === "primary") || images[0];
  const rawUri = chosen?.uri;
  if (typeof rawUri !== "string" || !rawUri) return json({ error: "no_cover" }, 404, cors);

  let target;
  try {
    target = new URL(rawUri);
  } catch {
    return json({ error: "no_cover" }, 404, cors);
  }
  if (target.protocol !== "https:" || !DISCOGS_IMAGE_HOSTS.has(target.hostname)) {
    return json({ error: "cover_host_rejected" }, 502, cors);
  }
  if (target.username || target.password) {
    return json({ error: "cover_host_rejected" }, 502, cors);
  }

  // No Discogs token here: the CDN does not need it, and it must not travel further
  // than api.discogs.com.
  const img = await fetch(target.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    redirect: "manual",
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (img.status >= 300 && img.status < 400) return json({ error: "cover_redirect_refused" }, 502, cors);
  if (!img.ok) return upstreamFailure(img, cors);

  const type = (img.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type)) return json({ error: "cover_type_rejected" }, 502, cors);

  const declared = parseInt(img.headers.get("Content-Length") || "", 10);
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    return json({ error: "cover_too_large" }, 502, cors);
  }

  // Streamed straight through: nothing is buffered, so a large image cannot exhaust
  // the Worker's memory. Content-Length is advisory and absent on a chunked response,
  // so the ceiling is also enforced on the bytes as they pass.
  return new Response(img.body.pipeThrough(byteLimit(MAX_IMAGE_BYTES)), {
    status: 200,
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": `public, max-age=${CACHE_SECONDS.cover}`,
      ...cors,
    },
  });
}

/**
 * Cuts the stream off past `max` bytes. The client sees a truncated image rather
 * than an unbounded download; the headers are already sent by then, so erroring
 * the stream is the only signal available.
 */
function byteLimit(max) {
  let seen = 0;
  return new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) {
        controller.error(new Error("cover_too_large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
}

// ---------------------------------------------------------------- routing

/**
 * Routes are matched on the trailing path segments, not with an endsWith test: the
 * Vinmonopolet route "/search" would otherwise also swallow "/discogs/search".
 * Matching the tail keeps the proxy mountable under any path prefix.
 */
function matchRoute(pathname) {
  const seg = pathname.split("/").filter(Boolean);
  const last = seg.at(-1) || "";
  const prev = seg.at(-2) || "";
  const prev2 = seg.at(-3) || "";

  if (prev === "discogs") {
    if (last === "search") return { name: "discogs_search" };
    if (last === "barcode") return { name: "discogs_barcode" };
    return null;
  }
  if (prev2 === "discogs" && /^\d{1,12}$/.test(last)) {
    if (prev === "release") return { name: "discogs_release", param: last };
    if (prev === "cover") return { name: "discogs_cover", param: last };
    return null;
  }
  if (last === "search") return { name: "vinmonopolet_search" };
  if (last === "barcode") return { name: "vinmonopolet_barcode" };
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // The shared token is extractable from the client bundle, so this is a quota gate
    // against direct calls — not real authentication.
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!env.CLIENT_TOKEN || token !== env.CLIENT_TOKEN) {
      // Charged against its own budget so a flood of rejected calls still costs the
      // caller its per-IP allowance rather than our request quota.
      if (await overRateLimit(env, ip, "auth")) return json({ error: "rate_limited" }, 429, cors);
      return json({ error: "unauthorized" }, 401, cors);
    }

    const url = new URL(request.url);
    const route = matchRoute(url.pathname);
    if (!route) return json({ error: "not_found" }, 404, cors);

    const isDiscogs = route.name.startsWith("discogs_");
    if (isDiscogs && !env.DISCOGS_TOKEN) {
      return json({ error: "discogs_not_configured" }, 503, cors);
    }

    const bucket = route.name === "discogs_cover" ? "img" : "api";
    if (await overRateLimit(env, ip, bucket)) return json({ error: "rate_limited" }, 429, cors);

    // The cache is consulted only after the token check above, so it can never hand
    // data to an unauthorized caller. The key is the path and query alone.
    const cache = caches.default;
    const cacheKey = new Request(new URL(url.pathname + url.search, url.origin).toString(), { method: "GET" });
    if (isDiscogs) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const headers = new Headers(hit.headers);
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        headers.set("X-Proxy-Cache", "hit");
        return new Response(hit.body, { status: hit.status, headers });
      }
    }

    const store = (response, seconds) => {
      const copy = response.clone();
      const headers = new Headers(copy.headers);
      headers.set("Cache-Control", `public, max-age=${seconds}`);
      ctx.waitUntil(cache.put(cacheKey, new Response(copy.body, { status: copy.status, headers })));
      return response;
    };

    try {
      switch (route.name) {
        // ---- Vinmonopolet (unchanged behaviour) ----
        case "vinmonopolet_search":
        case "vinmonopolet_barcode": {
          let param;
          if (route.name === "vinmonopolet_search") {
            const q = cleanQuery(url.searchParams.get("q"));
            if (!q) return json({ error: "missing_query" }, 400, cors);
            // Confirmed against the real API: the free-text parameter is
            // "productShortNameContains", and maxResults caps an otherwise unbounded
            // full-catalog response.
            param = `productShortNameContains=${encodeURIComponent(q)}&maxResults=25`;
          } else {
            // NOTE: the real products API has no EAN/barcode parameter at all. Kept
            // as-is pending a decision on an alternative source.
            const ean = (url.searchParams.get("ean") || "").trim();
            if (!isEan(ean)) return json({ error: "invalid_ean" }, 400, cors);
            param = `ean=${encodeURIComponent(ean)}&maxResults=25`;
          }
          const res = await fetch(`${VINMONOPOLET_UPSTREAM}?${param}`, {
            headers: { "Ocp-Apim-Subscription-Key": env.VINMONOPOLET_KEY, Accept: "application/json" },
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
          });
          if (!res.ok) return json({ error: "upstream_error", status: res.status }, res.status, cors);
          return json(await res.json(), 200, cors);
        }

        // ---- Discogs ----
        case "discogs_search":
        case "discogs_barcode": {
          let query;
          if (route.name === "discogs_search") {
            const q = cleanQuery(url.searchParams.get("q"));
            if (!q) return json({ error: "missing_query" }, 400, cors);
            query = `q=${encodeURIComponent(q)}`;
          } else {
            const ean = (url.searchParams.get("ean") || "").trim();
            if (!isEan(ean)) return json({ error: "invalid_ean" }, 400, cors);
            query = `barcode=${encodeURIComponent(ean)}`;
          }
          const res = await discogsFetch(`/database/search?${query}&type=release&per_page=25`, env);
          if (!res.ok) return upstreamFailure(res, cors);
          const data = await res.json();
          const results = (Array.isArray(data?.results) ? data.results : [])
            .map(projectSearchHit)
            .filter((r) => r.id);
          return store(json({ results }, 200, cors), CACHE_SECONDS.search);
        }

        case "discogs_release": {
          const res = await discogsFetch(`/releases/${route.param}`, env);
          if (!res.ok) return upstreamFailure(res, cors);
          const projected = projectRelease(await res.json());
          if (!projected.id) return json({ error: "not_found" }, 404, cors);
          return store(json(projected, 200, cors), CACHE_SECONDS.release);
        }

        case "discogs_cover": {
          const res = await fetchCover(route.param, env, cors);
          return res.status === 200 ? store(res, CACHE_SECONDS.cover) : res;
        }

        default:
          return json({ error: "not_found" }, 404, cors);
      }
    } catch (e) {
      // Never echo an upstream body or an exception message: both can carry data we
      // have not inspected. A timeout is the one case worth naming.
      const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
      return json({ error: timedOut ? "upstream_timeout" : "upstream_unreachable" }, 502, cors);
    }
  },
};
