/** Where a row stands inside its list, in pixels from the list's top left corner. */
export type Place = { top: number; left: number; width: number; height: number };

/**
 * What changed between two renders of a list, by row key: the rows that stand somewhere else now and how
 * far back they must start to glide from where they were, the rows that are new, and the rows that left.
 * A move under a pixel is not a move.
 */
export function motionPlan(
  before: ReadonlyMap<string, Place>,
  after: ReadonlyMap<string, Place>,
): { moved: { key: string; dx: number; dy: number }[]; entered: string[]; left: string[] } {
  const moved: { key: string; dx: number; dy: number }[] = [];
  const entered: string[] = [];
  for (const [key, now] of after) {
    const was = before.get(key);
    if (!was) {
      entered.push(key);
      continue;
    }
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) moved.push({ key, dx, dy });
  }
  const left = [...before.keys()].filter((key) => !after.has(key));
  return { moved, entered, left };
}
