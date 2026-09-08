// Every call to the Cloudflare Worker proxy goes through here. Neither the
// Vinmonopolet key nor the Discogs token exists in the client — the proxy holds both.

import { PROXY_URL, APP_TOKEN } from "../constants.js";

/** Images larger than this are refused; the proxy enforces the same ceiling. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const proxyConfigured = () => Boolean(PROXY_URL && APP_TOKEN);

function proxyError(code, reason) {
  const err = new Error(reason ? `proxy_${code}_${reason}` : `proxy_${code}`);
  err.code = code;
  // The proxy's own error string ("discogs_not_configured", "upstream_rate_limited", …).
  err.reason = reason ?? null;
  return err;
}

function buildUrl(path, params) {
  const base = PROXY_URL.endsWith("/") ? PROXY_URL : PROXY_URL + "/";
  const url = new URL(path.replace(/^\//, ""), base);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  return url;
}

async function request(path, params, signal, accept) {
  if (!proxyConfigured()) throw proxyError("not_configured");
  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      headers: { Authorization: `Bearer ${APP_TOKEN}`, Accept: accept },
      signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw proxyError("network");
  }
  if (!res.ok) {
    // The proxy answers with { error: "<code>" }; anything else is ignored.
    let reason = null;
    try {
      reason = (await res.clone().json())?.error ?? null;
    } catch {
      /* non-JSON body — the status alone has to do */
    }
    throw proxyError(res.status, typeof reason === "string" ? reason : null);
  }
  return res;
}

export async function proxyJson(path, params, signal) {
  const res = await request(path, params, signal, "application/json");
  return res.json();
}

/** Binary fetch used for cover art. Refuses anything that is not a bounded image. */
export async function proxyBlob(path, params, signal) {
  const res = await request(path, params, signal, "image/*");
  const declared = parseInt(res.headers.get("Content-Length") || "", 10);
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw proxyError("too_large");
  const blob = await res.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw proxyError("too_large");
  if (!/^image\//.test(blob.type)) throw proxyError("not_an_image");
  return blob;
}
