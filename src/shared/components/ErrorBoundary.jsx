import { Component } from "react";

/**
 * Last line of defence for a render that throws.
 *
 * The data behind a screen lives in IndexedDB, so a row that React refuses to
 * render is not a one-off crash: it re-throws on every load, and an unhandled
 * throw at the root unmounts the whole tree — a white screen the user cannot get
 * out of without wiping site data. The schemas coerce every stored field so this
 * should be unreachable; this keeps the app recoverable if one ever slips past.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Console only. Nothing is sent anywhere — the message can carry the user's
    // own collection data.
    console.error("Uventet feil i visningen:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-shell" style={{ padding: "var(--sp-4)" }}>
        <h1>Noe gikk galt</h1>
        <p className="hint">
          Appen klarte ikke å vise samlingen. Dataene dine ligger fortsatt lagret på
          enheten. Prøv å laste inn på nytt — hjelper det ikke, gjenopprett fra en
          sikkerhetskopi under Innstillinger.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Last inn på nytt
        </button>
      </div>
    );
  }
}
