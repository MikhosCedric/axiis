"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { deviceClock } from "@/lib/clock";
import { CLOCK_COOKIE, clockCookieValue, readClock, TZ_COOKIE } from "./cookies";

const YEAR = 31536000;

function cookie(name: string): string | undefined {
  const saved = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
  return saved === undefined ? undefined : decodeURIComponent(saved);
}

/**
 * Tells the server the browser's time zone, so "today" means the user's day,
 * and, while the time format is Auto, the clock the browser's language and
 * region use. One refresh when either has changed.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    let changed = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && cookie(TZ_COOKIE) !== tz) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=${YEAR}; samesite=lax`;
      changed = true;
    }
    const saved = cookie(CLOCK_COOKIE);
    if (readClock(saved).setting === "auto") {
      const value = clockCookieValue("auto", deviceClock());
      if (saved !== value) {
        document.cookie = `${CLOCK_COOKIE}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
        changed = true;
      }
    }
    if (!changed) return;
    return afterStreamedReveal(() => router.refresh());
  }, [router]);
  return null;
}

/** How long to wait for the streamed page to be revealed before refreshing anyway. */
const REVEAL_WAIT_MS = 3000;

/**
 * Runs `then` once the whole document has been parsed and React has moved every
 * streamed part into place (its hidden `S:` holders are gone). A refresh sent
 * earlier lands while a part is still waiting to be revealed; React then
 * draws that part afresh and the hidden holder is left behind for good, a
 * second copy of the page under the body. Returns a cancel.
 */
function afterStreamedReveal(then: () => void): () => void {
  let frame = 0;
  const giveUp = performance.now() + REVEAL_WAIT_MS;
  const pending = () => document.querySelector('body > div[hidden][id^="S:"]') !== null;
  const look = () => {
    if (pending() && performance.now() < giveUp) frame = requestAnimationFrame(look);
    else then();
  };
  // The whole document has been parsed once it is no longer "loading", so every streamed part has arrived.
  const start = () => look();
  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("DOMContentLoaded", start);
  };
}
