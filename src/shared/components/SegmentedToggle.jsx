/**
 * Generic segmented control. Knows no domain fields (ADR-5): it takes
 * `options: [{ value, label }]` and reports the picked value.
 * Replaces the wine-only WishlistToggle.
 *
 * Implements the radiogroup keyboard contract (WCAG 4.1.2): one tab stop,
 * arrow keys move between options.
 */
export default function SegmentedToggle({ options, value, onChange, ariaLabel = "Valg" }) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e) => {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 :
      e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (activeIndex + dir + options.length) % options.length;
    onChange(options[next].value);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="segmented" onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={i === activeIndex ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
