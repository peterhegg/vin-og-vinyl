import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

/**
 * A form can open with a full-resolution cover attached (a Discogs pick, or the
 * image read back when editing). That image is a few hundred kilobytes, and
 * everything in `nav` is serialised into a history entry — so pushing it would
 * copy the picture into the session history on every single form open, and a
 * long editing session can run the browser's history-state quota dry (Firefox
 * caps it, and pushState *throws* when it does).
 *
 * The image is therefore held here, outside history, and the entry carries only
 * a token. Old entries are dropped so the map cannot grow without bound. After a
 * reload the token no longer resolves: the form then opens without a preview,
 * and because it never marks the cover as touched, the stored image is left
 * alone. Nothing is lost.
 */
const formCovers = new Map();
const MAX_FORM_COVERS = 4;
let formToken = 0;

function rememberCover(cover) {
  const token = `f${++formToken}`;
  if (cover) {
    formCovers.set(token, cover);
    for (const old of formCovers.keys()) {
      if (formCovers.size <= MAX_FORM_COVERS) break;
      formCovers.delete(old);
    }
  }
  return token;
}

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
  const openForm = useCallback(
    (form) => {
      if (!form) return go({ form: null, detailId: null });
      const { cover, ...rest } = form;
      go({ form: { ...rest, coverToken: rememberCover(cover) }, detailId: null });
    },
    [go]
  );

  // Screens still read `nav.form.cover`: the image is put back on the way out,
  // it just never travelled through history to get here.
  const navWithCover = useMemo(() => {
    if (!nav.form) return nav;
    return { ...nav, form: { ...nav.form, cover: formCovers.get(nav.form.coverToken) ?? null } };
  }, [nav]);

  return { nav: navWithCover, back, setCollection, setTab, openDetail, openForm };
}
