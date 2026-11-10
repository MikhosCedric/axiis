"use client";

import { useEffect, useSyncExternalStore } from "react";

/** The browser tests turn the worker on per test with this cookie, so no other test meets it (docs/e2e-session.md). */
const E2E_COOKIE = "axiis-sw=1";

function wanted(): boolean {
  if (process.env.NODE_ENV === "development") return false;
  if (process.env.AXIIS_E2E_BUILD === "1") return document.cookie.split("; ").includes(E2E_COOKIE);
  return true;
}

/**
 * Registers the worker that keeps the pages you read for offline (ADR-0002, stage 2b). On the first visit the
 * worker does not yet control this page, so the page asks it to keep itself once it does.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !wanted()) return;
    let cancelled = false;
    // The worker claims this page as it starts, so ask before registering: only a page it did not load needs keeping.
    const controlled = navigator.serviceWorker.controller !== null;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled || controlled) return;
        registration.active?.postMessage({ type: "keep", url: location.pathname + location.search });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/**
 * Mounted on the sign-in page: whoever sees it is signed out, so the worker drops every saved page. The worker
 * also does this on a navigation to /login; this covers a page the worker did not see load.
 */
export function ForgetSavedPages() {
  useEffect(() => {
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "forget-all" });
    } catch {}
  }, []);
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Says so while there is no connection, since the page may be the last saved copy. */
export function OfflineNotice() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <p role="status" className="mx-auto max-w-[720px] px-5 pt-3 text-[13px] font-medium text-ink">
      Offline. You are seeing the last saved copy of this page. New captures are kept on this device; other changes need a connection.
    </p>
  );
}
