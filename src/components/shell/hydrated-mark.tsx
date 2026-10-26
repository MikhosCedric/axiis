"use client";

import { useEffect } from "react";

/**
 * Marks `<html data-hydrated>` once React has hydrated the page. It is the last thing in the body, and
 * effects run in tree order, so the palette's key listener and every other effect hydrated in the same
 * commit have run by then. Browser tests wait for it before pressing keys (e2e/session.ts).
 */
export function HydratedMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "";
  }, []);
  return null;
}
