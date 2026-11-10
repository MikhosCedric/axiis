"use client";

import { createContext, useContext, type ReactNode } from "react";
import { WEEK_STARTS_ON, type WeekStart } from "@/features/week/week-of";

const WeekStartContext = createContext<WeekStart>(WEEK_STARTS_ON);

/** The first day of the week the server read from the cookie, so the browser steps weeks the way the server drew them. */
export function WeekStartProvider({ start, children }: { start: WeekStart; children: ReactNode }) {
  return <WeekStartContext value={start}>{children}</WeekStartContext>;
}

export function useWeekStart(): WeekStart {
  return useContext(WeekStartContext);
}
