// Input sanitizers shared by every collection's schema.
// Anything that can arrive from an import file or an external API passes through here
// before it is stored or rendered.

/**
 * Only allow absolute http(s) external links. Blocks javascript:/data:/vbscript: URLs
 * that could otherwise arrive via a malicious import file and execute on click.
 *
 * Parsed without a base on purpose: with `window.location.origin` as base, any
 * garbage string ("../admin", "relative-path") resolved into a real link back to
 * the app's own origin. A stored external link is either absolute or nothing.
 */
export function safeExternalUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Credentials in a URL are only ever there to disguise the real host.
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Only allow inline image data URLs (wine labels, record covers). */
export function safeImageDataUrl(value) {
  if (typeof value !== "string" || !value) return null;
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) ? value : null;
}

/** Ceiling for a single free-text field. Longer values are cut, not rejected. */
export const MAX_TEXT = 2000;

/**
 * Coerce an untrusted value into a plain string.
 *
 * A backup file — or a compromised upstream API — can put an object or an array
 * where a string belongs. React throws on an object child, and once such a row is
 * in IndexedDB the throw repeats on every render: a white screen that survives a
 * reload and can only be cleared by wiping site data. Coercing here, before the
 * value is stored, is the only place that stops it.
 */
export function safeText(value, max = MAX_TEXT) {
  if (typeof value === "string") return value.slice(0, max).trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

/** Same, but an empty result is `null` — for fields the UI tests with `!= null`. */
export function safeTextOrNull(value, max = MAX_TEXT) {
  return safeText(value, max) || null;
}

/**
 * A finite number inside sane bounds, or null. Rejects `[]` (which `Number()`
 * turns into 0), objects, NaN and Infinity alike.
 */
export function safeNumber(value, { min = -1e12, max = 1e12, integer = false } = {}) {
  if (value === "" || value == null || typeof value === "boolean") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return integer ? Math.trunc(n) : n;
}

/** A non-negative integer counter (quantity, plays), never NaN and never unbounded. */
export function safeCount(value, max = 1e6) {
  const n = safeNumber(value, { min: 0, max, integer: true });
  return n ?? 0;
}

/**
 * An IndexedDB primary key we can actually store. A non-string id (`{}` from a
 * hand-edited file) makes `put()` throw DataError *synchronously*, which used to
 * escape mid-transaction and leave the writes queued before it committed anyway.
 */
export function safeId(value) {
  if (typeof value === "string" && value.trim() && value.length <= 200) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return crypto.randomUUID();
}

/** An ISO timestamp string, or the fallback. Never an object. */
export function safeIsoDate(value, fallback = null) {
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return value.slice(0, 40);
  }
  return fallback;
}
