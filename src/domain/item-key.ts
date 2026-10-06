import { parseLocalDate } from "@/lib/dates";
import { idSchema, type ItemId, type LocalDate, type ShownItem } from "./item";

/** Names one occurrence of a series that has not been stored: `<seriesId>~<YYYY-MM-DD>`. A `~` never appears in a uuid. */
export type OccurrenceKey = string & { readonly __brand: "OccurrenceKey" };

/** What the client may send to point at something it was shown: a stored item, or an occurrence of a series. */
export type ItemKey = ItemId | OccurrenceKey;

export type ParsedItemKey =
  | { kind: "item"; id: ItemId }
  | { kind: "occurrence"; seriesId: ItemId; originalOn: LocalDate };

export function occurrenceKey(seriesId: ItemId, originalOn: LocalDate): OccurrenceKey {
  return `${seriesId}~${originalOn}` as OccurrenceKey;
}

/**
 * The id of the shown item that `selected` names. An override also answers to
 * its occurrence key, which the URL still holds after a first change stored it.
 */
export function selectedIn(items: readonly ShownItem[], selected: string | null): string | null {
  if (selected === null) return null;
  const hit = items.find(
    (i) =>
      i.id === selected ||
      (i.recurrence.kind === "override" && occurrenceKey(i.recurrence.seriesId, i.recurrence.originalOn) === selected),
  );
  return hit ? hit.id : selected;
}

/** Parses an untrusted key, or null when it is neither form. */
export function parseItemKey(raw: unknown): ParsedItemKey | null {
  if (typeof raw !== "string") return null;
  const tilde = raw.indexOf("~");
  if (tilde === -1) {
    const id = idSchema.safeParse(raw);
    return id.success ? { kind: "item", id: id.data as ItemId } : null;
  }
  const seriesId = idSchema.safeParse(raw.slice(0, tilde));
  const originalOn = parseLocalDate(raw.slice(tilde + 1));
  if (!seriesId.success || !originalOn) return null;
  return { kind: "occurrence", seriesId: seriesId.data as ItemId, originalOn };
}
