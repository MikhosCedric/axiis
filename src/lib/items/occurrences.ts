import type { Item, SpanRange, VirtualItem } from "@/domain/item";
import { occurrenceKey, type ParsedItemKey } from "@/domain/item-key";
import { addDays, dayRangeFor } from "@/lib/dates";
import { expandSeries, liveOccurrences, type Occurrence, type SeriesSource } from "./expand";
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

/** What a key names right now: a stored item (an override, once one exists), or an occurrence not yet stored. */
export type Resolved = { kind: "stored"; item: Item } | { kind: "virtual"; series: Item; item: VirtualItem };

/**
 * Looks a key up without writing. An occurrence key resolves to its override
 * when there is one, and is null unless the series really falls on that date.
 */
export async function resolveKey(repo: ItemsRepo, key: ParsedItemKey, timeZone: string): Promise<Resolved | null> {
  if (key.kind === "item") {
    const item = await repo.get(key.id);
    return item && { kind: "stored", item };
  }
  const { seriesId, originalOn } = key;
  const [series, overrides] = await Promise.all([
    repo.get(seriesId),
    repo.listOverrides(originalOn, addDays(originalOn, 1), seriesId),
  ]);
  if (overrides[0]) return { kind: "stored", item: overrides[0] };
  const source = series && seriesSource(series);
  if (!series || !source) return null;
  const day = dayRangeFor(originalOn, timeZone);
  const span = { from: day.from, to: day.to, fromDate: originalOn, toDate: addDays(originalOn, 1) };
  const occurrence = expandSeries(source, span, timeZone)[0];
  return occurrence ? { kind: "virtual", series, item: virtualItem(series, occurrence) } : null;
}

/**
 * The stored item a key names, creating the override for an occurrence the
 * first time it is touched. Safe to repeat: a second call, or one that loses a
 * race to the unique index, finds the override the first call made.
 */
export async function materialize(repo: ItemsRepo, key: ParsedItemKey, timeZone: string): Promise<Item | null> {
  const found = await resolveKey(repo, key, timeZone);
  if (!found) return null;
  if (found.kind === "stored") return found.item;
  const { series, item } = found;
  try {
    return await repo.create({
      type: series.type,
      title: series.title,
      body: series.body,
      areaId: series.areaId,
      schedule: item.schedule,
      recurrence: { kind: "override", seriesId: item.recurrence.seriesId, originalOn: item.recurrence.originalOn },
    });
  } catch (error) {
    const again = await resolveKey(repo, key, timeZone);
    if (again?.kind === "stored") return again.item;
    throw error;
  }
}

/**
 * Every virtual occurrence in the span: each live series expanded, minus the
 * dates an override stands for. The live series come back too, for views that
 * describe them.
 */
export async function loadOccurrences(
  repo: ItemsRepo,
  span: SpanRange,
  timeZone: string,
): Promise<{ occurrences: VirtualItem[]; series: Item[] }> {
  const [series, overrides] = await Promise.all([repo.listSeries(), repo.listOverrides(span.fromDate, span.toDate)]);
  const byId = new Map(series.map((s) => [s.id, s]));
  const sources = series.map(seriesSource).filter((s) => s !== null);
  const claims = overrides.flatMap((o) => (o.recurrence.kind === "override" ? [o.recurrence] : []));
  const occurrences = liveOccurrences(sources, claims, span, timeZone).map((o) => virtualItem(byId.get(o.seriesId)!, o));
  return { occurrences, series };
}
