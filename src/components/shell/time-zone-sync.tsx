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
    if (changed) router.refresh();
  }, [router]);
  return null;
}
