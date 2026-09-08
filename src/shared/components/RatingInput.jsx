/**
 * 1–max rating, rendered as a row of tappable glyphs. Click a glyph to set the
 * score, click the active one again to clear. Knows no domain fields (ADR-5):
 * `glyph` picks the mark, `max` the range. Replaces the wine-only CorkRating.
 *
 * Inactive glyphs use `--rating-empty`, which is contrast-checked (≥3:1) against
 * every surface they sit on — never the raw panel color.
 */

const GLYPHS = {
  // Wine: a cork with a gold base.
  cork: (active, size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="7" y="2" width="10" height="8" rx="2" fill={active ? "var(--cork)" : "var(--rating-empty)"} />
      <rect x="9" y="10" width="6" height="11" rx="1" fill={active ? "var(--gold)" : "var(--rating-empty)"} />
    </svg>
  ),
  // Vinyl: a record. Active = a solid accent disc with a dark label hole (bold,
  // like the active cork). Inactive = a thin hollow ring (clearly lighter).
  disc: (active, size) =>
    active ? (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10" fill="var(--accent)" />
        <circle cx="12" cy="12" r="3.4" fill="var(--bg)" />
        <circle cx="12" cy="12" r="1" fill="var(--accent)" />
      </svg>
    ) : (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--rating-empty)" strokeWidth="2" />
      </svg>
    ),
};

export default function RatingInput({
  value,
  onChange,
  readOnly = false,
  size = 20,
  max = 10,
  glyph = "cork",
  label = "Vurdering",
}) {
  const items = Array.from({ length: max }, (_, i) => i + 1);
  const draw = GLYPHS[glyph] ?? GLYPHS.cork;
  const groupLabel = value != null ? `${value} av ${max}` : `Ingen ${label.toLowerCase()} satt`;

  return (
    <div
      role={readOnly ? "img" : "radiogroup"}
      aria-label={readOnly ? groupLabel : label}
      style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
    >
      {items.map((n) => {
        const active = value != null && n <= value;
        const content = draw(active, size);
        if (readOnly) return <span key={n}>{content}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} av ${max}`}
            onClick={() => onChange(value === n ? null : n)}
            style={{ padding: 6, minHeight: 44, minWidth: 44 }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
