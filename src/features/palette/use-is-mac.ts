"use client";

import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** True on Apple platforms, where the shortcut is Cmd. False while rendering on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}
