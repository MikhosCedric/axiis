"use client";

import { useSyncExternalStore } from "react";
import { SERVER_MINUTES } from "./live-day";

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    timer = setTimeout(() => {
      onChange();
      arm();
    }, 60_000 - (Date.now() % 60_000) + 50);
  };
  arm();
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Minutes past local midnight on this device, current to the minute. The server cannot know the
 * visitor's clock, so it draws SERVER_MINUTES and the browser moves to the real time once hydrated.
 */
export function useNowMinutes(): number {
  return useSyncExternalStore(subscribe, minutesNow, () => SERVER_MINUTES);
}
