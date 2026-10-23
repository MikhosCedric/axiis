/**
 * How a change of the selected item (`?item=`) moves through the browser's
 * history. Opening the panel adds an entry, so Back closes it; switching to
 * another item replaces that entry, so Back never walks through every item
 * looked at; closing an entry this tab added goes back over it, so Forward
 * opens it again. Any other close (a deep link, a reload) replaces.
 */
export type SelectionStep = "push" | "replace" | "back" | "none";

export function selectionStep({
  from,
  to,
  here,
  opened,
}: {
  /** The item selected now, or null. */
  from: string | null;
  /** The item wanted, or null to close. */
  to: string | null;
  /** The address now, path and query. */
  here: string;
  /** The address of the entry this tab added when it last opened the panel, or null. */
  opened: string | null;
}): SelectionStep {
  if (from === to) return "none";
  if (from === null) return "push";
  if (to !== null) return "replace";
  return opened === here ? "back" : "replace";
}

/** The address with `item` selected, or with none, keeping every other query param. */
export function withItem(pathname: string, search: string, param: string, item: string | null): string {
  const next = new URLSearchParams(search);
  if (item === null) next.delete(param);
  else next.set(param, item);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
