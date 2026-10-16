"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Clock } from "@/lib/clock";

const ClockContext = createContext<Clock>("24");

/** The clock the server read from the cookie, so the browser writes every time the same way the server did. */
export function ClockProvider({ clock, children }: { clock: Clock; children: ReactNode }) {
  return <ClockContext value={clock}>{children}</ClockContext>;
}

export function useClock(): Clock {
  return useContext(ClockContext);
}
