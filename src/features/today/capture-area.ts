import { AREA_PARAM } from "@/features/filter/href";
import type { NamedArea } from "@/components/shell/areas-context";
import { parseCapture, type CaptureArea } from "./capture-syntax";
import { TITLE_MAX } from "./model";

/** The one area a page is narrowed to by `?area=`, or null when it is not narrowed or the area is gone. */
export function filteredArea(query: string | URLSearchParams, areas: readonly NamedArea[] | undefined): NamedArea | null {
  const id = new URLSearchParams(query).get(AREA_PARAM);
  return (id && areas?.find((a) => a.id === id)) || null;
}

/**
 * The words with "@area" added when the page is narrowed to one area and the words name none, so a capture made
 * there lands in that area. Left as typed when it already names an area, or the area's name cannot be said with "@".
 */
export function withDefaultArea(text: string, area: NamedArea | null, areas: readonly NamedArea[] | undefined): string {
  if (!area || !text.trim() || /@/.test(area.name)) return text;
  if (parseCapture(text, { areas: areas as readonly CaptureArea[] | undefined }).area) return text;
  const next = `${text.trim()} @${area.name}`;
  return next.length > TITLE_MAX ? text : next;
}
