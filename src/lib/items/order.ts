/**
 * Manual order, kept in `position` (a double, default 0). Rows sort by position first, so a row nobody has moved
 * sits at 0 and falls back to the list's own rule (creation time).
 *
 * `end` says where a row at 0 belongs among the moved ones. Subtasks and checklist lines are added at the end, so
 * their moved rows take negative positions and a new line (0) lands after them. The Lists page shows the newest
 * first, so its moved rows take positive positions and a new checklist (0) lands before them.
 */
export type OrderEnd = "new-last" | "new-first";

export type Placed = { id: string; position: number };

const inside = (p: number, end: OrderEnd) => (end === "new-last" ? p < 0 : p > 0);

/** True when the positions alone already sort the rows this way, with every one on its side of zero. */
function settled(rows: readonly Placed[], end: OrderEnd): boolean {
  return rows.every((r, i) => inside(r.position, end) && (i === 0 || rows[i - 1].position < r.position));
}

/**
 * The fewest writes that make `rows`, given in the order wanted, sort that way by position. A list moved before
 * usually needs one: the moved row goes halfway between its new neighbours. Otherwise (first move, rows added since,
 * or no room left between two neighbours) every row is numbered again, and only the ones that change are written.
 */
export function planOrder(rows: readonly Placed[], end: OrderEnd): Placed[] {
  if (rows.length < 2 || settled(rows, end)) return [];
  for (let i = 0; i < rows.length; i++) {
    const rest = rows.filter((_, j) => j !== i);
    if (!settled(rest, end)) continue;
    const before = rows[i - 1]?.position;
    const after = rows[i + 1]?.position;
    // An open side is two steps wide, except toward zero, where the list's unmoved rows wait.
    const low = before ?? (end === "new-first" ? 0 : after - 2);
    const high = after ?? (end === "new-last" ? 0 : before + 2);
    const position = (low + high) / 2;
    if (position > low && position < high) return [{ id: rows[i].id, position }];
  }
  const first = end === "new-last" ? -rows.length : 1;
  return rows.map((r, i) => ({ id: r.id, position: first + i })).filter((r, i) => r.position !== rows[i].position);
}

/** `ids` with the one at `from` moved to `to`. Out of range, or no move, gives the same order back. */
export function moved<T>(ids: readonly T[], from: number, to: number): T[] {
  const next = [...ids];
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return next;
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
