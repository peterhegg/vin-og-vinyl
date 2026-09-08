/**
 * Small line icons drawn in `currentColor`. Replaces the cross-platform emoji
 * that used to sit in the bottom nav, the list thumbnails and the empty states
 * (Fase 8) — those rendered differently on every OS and clashed with the app
 * icon's language. Decorative by default: callers own the accessible name.
 */

const PATHS = {
  // Bottom nav
  collection: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M3.5 10.5h17M9 6V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  // Gear — Feather "settings" (MIT).
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  // Thumbnails / empty states
  wine: (
    <>
      <path d="M8 4h8l-.6 6a3.4 3.4 0 0 1-6.8 0z" />
      <path d="M12 13.4V19M9 19h6" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  music: <path d="M9 17V5l10-2v12M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />,
};

export default function Glyph({ name, className, size, title }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {body}
    </svg>
  );
}
