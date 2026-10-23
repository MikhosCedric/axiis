"use client";

import { createContext, useContext, type ReactNode } from "react";
import { tagKey, type TagColors } from "@/domain/tag";

const Colors = createContext<TagColors>({});

/** The tag colours a page loaded with its items, for every tag line inside it. A page wraps its view in it. */
export function TagColorsProvider({ value, children }: { value: TagColors; children: ReactNode }) {
  return <Colors value={value}>{children}</Colors>;
}

/** A tag's colour on this screen, or null for none. */
export function useTagColor(): (name: string) => TagColors[string] | null {
  const colors = useContext(Colors);
  return (name) => colors[tagKey(name)] ?? null;
}
