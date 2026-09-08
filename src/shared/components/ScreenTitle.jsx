import { useFocusOnMount } from "../useFocusOnMount.js";

/**
 * The <h1> for a screen that opens on top of the list (add, form, settings).
 * Takes focus on mount so a screen-reader user lands on the new screen's name
 * instead of staying where the list was (WCAG 2.4.3).
 */
export default function ScreenTitle({ children, style }) {
  const ref = useFocusOnMount();
  return (
    <h1
      className="screen-title"
      ref={ref}
      tabIndex={-1}
      style={{ marginBottom: "var(--sp-4)", outline: "none", ...style }}
    >
      {children}
    </h1>
  );
}
