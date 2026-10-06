import type { ItemId } from "@/domain/item";
import type { ChildCount } from "@/lib/items/repo";

/** One checklist on the Lists page, ready to draw. */
export type ListRow = {
  id: ItemId;
  title: string;
  done: boolean;
  repeats: boolean;
  /** When it is planned or how it repeats; null when it has no day. */
  when: string | null;
  area: string | null;
  /** Lines done of all its lines. Null for a series, which never has lines of its own. */
  progress: ChildCount | null;
};

/** Everything the Lists page needs, loaded on the server and serializable to the client. */
export type ListsData = {
  rows: ListRow[];
  /** The read hit its cap, so older checklists may not be shown. */
  full: boolean;
};

export const LISTS_PATH = "/lists";

/** How far along a checklist is, as a share of 1 for the meter. Nothing to do reads as nothing done. */
export function progressShare({ done, total }: ChildCount): number {
  return total === 0 ? 0 : done / total;
}

export function progressWords({ done, total }: ChildCount): string {
  if (total === 0) return "No lines yet";
  if (done === total) return total === 1 ? "Its one line is done" : `All ${total} lines done`;
  return `${done} of ${total} done`;
}

export function listsSummary(rows: readonly { done: boolean }[]): string {
  if (rows.length === 0) return "No checklists yet.";
  const done = rows.filter((r) => r.done).length;
  const open = rows.length - done;
  const lists = (n: number) => (n === 1 ? "checklist" : "checklists");
  if (done === 0) return `${open} ${lists(open)} open.`;
  return `${open === 0 ? "None" : open} open, ${done} done.`;
}
