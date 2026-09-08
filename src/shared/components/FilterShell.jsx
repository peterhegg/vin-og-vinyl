import { useState } from "react";

/**
 * The reusable skeleton of a filter bar (ADR-5): a free-text search box and a
 * collapsible "more filters" section. The domain-specific controls are passed
 * in — `children` render in the always-visible row, `extra` in the expander.
 * Knows no wine or vinyl field itself.
 */
export default function FilterShell({
  search,
  onSearch,
  searchPlaceholder = "Søk…",
  searchLabel,
  children,
  extra,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="stack-sm">
      <input
        type="search"
        className="input"
        placeholder={searchPlaceholder}
        value={search || ""}
        onChange={(e) => onSearch(e.target.value)}
        aria-label={searchLabel || searchPlaceholder}
      />

      {children && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {children}
        </div>
      )}

      {extra && (
        <>
          <button
            type="button"
            className="btn-link"
            style={{ alignSelf: "flex-start", minHeight: 36 }}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Færre filtre ▲" : "Flere filtre ▼"}
          </button>
          {expanded && <div className="grid-2">{extra}</div>}
        </>
      )}
    </div>
  );
}
