/**
 * Vin og vinyl proxy — hides the Vinmonopolet subscription key and adds CORS.
 *
 * Secrets (set with `wrangler secret put ...`):
 *   VINMONOPOLET_KEY   Ocp-Apim-Subscription-Key from developer.vinmonopolet.no
 *   CLIENT_TOKEN       shared secret; must equal the client's VITE_APP_TOKEN
 *
 * Vars (wrangler.toml [vars]):
 *   ALLOWED_ORIGINS    comma-separated list of allowed browser origins
 *
 * Client calls:
 *   GET /search?q=<term>     → Vinmonopolet ?ProductShortName=<term>
 *   GET /barcode?ean=<ean>   → Vinmonopolet ?ean=<ean>
 * with header  Authorization: Bearer <CLIENT_TOKEN>
 */

const UPSTREAM = "https://apis.vinmonopolet.no/products/v0/details-normal";

function corsHeaders(origin, allowed) {
  const ok = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    // Auth: client must present the shared token.
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!env.CLIENT_TOKEN || token !== env.CLIENT_TOKEN) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    // Rate limit per IP. The shared token is extractable from the client bundle,
    // so this caps quota abuse from direct (non-browser) calls. No-op if KV unbound.
    if (env.RATE_LIMIT_KV) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const key = `rl:${ip}`;
      const count = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
      if (count >= 60) {
        return json({ error: "rate_limited" }, 429, cors);
      }
      // 60 requests per rolling minute.
      await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 60 });
    }

    const url = new URL(request.url);
    let upstreamParam;
    if (url.pathname.endsWith("/search")) {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return json({ error: "missing_query" }, 400, cors);
      // Confirmed against the real API: the products/v0/details-normal endpoint
      // has no free-text field named "ProductShortName" — the actual parameter
      // is "productShortNameContains". maxResults caps an otherwise unbounded
      // full-catalog response (verified: an unrecognized param is silently
      // ignored rather than rejected, returning the entire catalog).
      upstreamParam = `productShortNameContains=${encodeURIComponent(q)}&maxResults=25`;
    } else if (url.pathname.endsWith("/barcode")) {
      // NOTE: the real products API has no EAN/barcode parameter at all.
      // This route is kept as-is pending a decision on an alternative source;
      // it will currently return unfiltered/empty results, never a real match.
      const ean = (url.searchParams.get("ean") || "").trim();
      if (!/^\d{8,14}$/.test(ean)) return json({ error: "invalid_ean" }, 400, cors);
      upstreamParam = `ean=${encodeURIComponent(ean)}&maxResults=25`;
    } else {
      return json({ error: "not_found" }, 404, cors);
    }

    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}?${upstreamParam}`, {
        headers: {
          "Ocp-Apim-Subscription-Key": env.VINMONOPOLET_KEY,
          Accept: "application/json",
        },
      });
    } catch {
      return json({ error: "upstream_unreachable" }, 502, cors);
    }

    if (!upstream.ok) {
      return json({ error: "upstream_error", status: upstream.status }, upstream.status, cors);
    }

    const data = await upstream.json();
    return json(data, 200, cors);
  },
};
