"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often a window kept in the tray looks again, so its tray list and reminders follow changes made elsewhere. */
const EVERY_MS = 10 * 60 * 1000;

/**
 * Desktop shell only. While the window is hidden, nothing else would refresh the page, and the reminders and the
 * tray list are read from it. A refresh offline would make Next load the whole page again (the browser's error page,
 * losing what was typed), so it waits for the connection.
 */
export function DesktopRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden" && navigator.onLine) router.refresh();
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
