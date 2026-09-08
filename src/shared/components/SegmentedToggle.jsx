/**
 * Generic segmented control. Knows no domain fields (ADR-5): it takes
 * `options: [{ value, label }]` and reports the picked value.
 * Replaces the wine-only WishlistToggle.
 */
export default function SegmentedToggle({ options, value, onChange, ariaLabel = "Valg" }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
