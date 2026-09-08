// Input sanitizers shared by every collection's schema.
// Anything that can arrive from an import file or an external API passes through here
// before it is stored or rendered.

/**
 * Only allow http(s) external links. Blocks javascript:/data:/vbscript: URLs
 * that could otherwise arrive via a malicious import file and execute on click.
 */
export function safeExternalUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value, window.location.origin);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Only allow inline image data URLs (wine labels, record covers). */
export function safeImageDataUrl(value) {
  if (typeof value !== "string" || !value) return null;
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) ? value : null;
}
