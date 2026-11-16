"use client";

import { createContext, useContext, type ReactNode } from "react";

/** An area as capture needs it: enough to match "@work" and say its name back. */
export type NamedArea = { id: string; name: string };

const AreasContext = createContext<readonly NamedArea[] | undefined>(undefined);

/** The user's areas as the shell loaded them, so the capture field can match "@work" while it is typed. */
export function AreasProvider({ areas, children }: { areas: readonly NamedArea[]; children: ReactNode }) {
  return <AreasContext value={areas}>{children}</AreasContext>;
}

/** Undefined outside the app shell (a harness page with no areas), where an "@name" is left alone. */
export function useAreas(): readonly NamedArea[] | undefined {
  return useContext(AreasContext);
}
