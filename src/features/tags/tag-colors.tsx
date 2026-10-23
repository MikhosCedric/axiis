"use client";

import { createContext, useContext } from "react";
import { tagKey, type TagColors } from "@/domain/tag";

const Colors = createContext<TagColors>({});

/** The tag colours a screen loaded with its items, for every tag line inside it. */
export const TagColorsProvider = Colors;

/** A tag's colour on this screen, or null for none. */
export function useTagColor(): (name: string) => TagColors[string] | null {
  const colors = useContext(Colors);
  return (name) => colors[tagKey(name)] ?? null;
}
