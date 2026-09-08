import { useEffect, useRef } from "react";

/**
 * Move keyboard focus to an element when it mounts, so opening a detail or form
 * screen doesn't leave focus stranded on a control that no longer exists
 * (WCAG 2.4.3). The target needs tabIndex={-1}; programmatic focus there moves
 * the screen-reader cursor and the next Tab origin without drawing a focus ring.
 */
export function useFocusOnMount() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.focus({ preventScroll: true });
  }, []);
  return ref;
}
