import { useCallback, useEffect, useRef, useState } from "react";

// One place for all navigation state (ADR-2). No router library: every screen
// change is a history.pushState, and the browser's back button (Android's
// hardware key included) pops it via popstate. The stack the user walks back
// through is detalj → skjema → fane → out of the app.

const HOME = { collection: "wine", tab: "list", detailId: null, form: null };

const sameNav = (a, b) =>
  a.collection === b.collection &&
  a.tab === b.tab &&
  a.detailId === b.detailId &&
  a.form === b.form;

export function useNav() {
  const [nav, setNav] = useState(() => ({ ...HOME, ...(window.history.state?.nav || {}) }));
  // Mirrors `nav`, but is also updated synchronously inside go() so a burst of
  // calls in one tick composes correctly.
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    // Stamp our state onto the entry the app loaded on, so a later back() that
    // lands here restores a real state object instead of null.
    if (!window.history.state?.nav) {
      window.history.replaceState({ nav: navRef.current }, "");
    }
    const onPop = (e) => {
      const next = e.state?.nav ? e.state.nav : HOME;
      navRef.current = next;
      setNav(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * Merge a patch into the nav state and push (or replace) one history entry.
   * pushState is kept out of the setState updater on purpose — an updater must
   * be pure, and StrictMode double-invokes it (which would double the entry).
   */
  const go = useCallback((patch, { replace = false } = {}) => {
    const next = { ...navRef.current, ...patch };
    if (sameNav(navRef.current, next)) return;
    const entry = { nav: next };
    if (replace) window.history.replaceState(entry, "");
    else window.history.pushState(entry, "");
    navRef.current = next;
    setNav(next);
  }, []);

  const back = useCallback(() => window.history.back(), []);

  const setCollection = useCallback(
    (collection) => go({ collection, detailId: null, form: null }),
    [go]
  );
  const setTab = useCallback((tab) => go({ tab, detailId: null, form: null }), [go]);
  const openDetail = useCallback((detailId) => go({ detailId, form: null }), [go]);
  const openForm = useCallback((form) => go({ form, detailId: null }), [go]);

  return { nav, back, setCollection, setTab, openDetail, openForm };
}
