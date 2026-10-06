import type { Item, SpanRange, VirtualItem } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { liveOccurrences, type Occurrence, type SeriesSource } from "./expand";
import type { ItemsRepo } from "./repo";

/** A series as the expander reads it, or null for anything that does not repeat. */
export function seriesSource(item: Item): SeriesSource | null {
  return item.recurrence.kind === "series" ? { id: item.id, schedule: item.schedule, rule: item.recurrence.rule } : null;
}

/** Draws one occurrence with the series' own title, type and area. It starts open: done lives on an override. */
export function virtualItem(series: Item, occurrence: Occurrence): VirtualItem {
  return {
    ...series,
    id: occurrenceKey(occurrence.seriesId, occurrence.originalOn),
    recurrence: { kind: "occurrence", seriesId: occurrence.seriesId, originalOn: occurrence.originalOn },
    schedule: occurrence.schedule,
    status: "open",
    completedAt: null,
    dueOn: null,
  };
}

/** Every virtual occurrence in the span: each live series expanded, minus the dates an override stands for. */
export async function loadOccurrences(repo: ItemsRepo, span: SpanRange, timeZone: string): Promise<VirtualItem[]> {
  const [series, overrides] = await Promise.all([repo.listSeries(), repo.listOverrides(span.fromDate, span.toDate)]);
  const byId = new Map(series.map((s) => [s.id, s]));
  const sources = series.map(seriesSource).filter((s) => s !== null);
  const claims = overrides.flatMap((o) => (o.recurrence.kind === "override" ? [o.recurrence] : []));
  return liveOccurrences(sources, claims, span, timeZone).map((o) => virtualItem(byId.get(o.seriesId)!, o));
}
