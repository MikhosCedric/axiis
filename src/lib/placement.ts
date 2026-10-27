export type Box = { left: number; top: number; width: number; height: number };

/**
 * Where a floating layer of `size` goes beside `anchor` in a window of `view`:
 * under it, its left edges lined up, flipped above when it does not fit below,
 * and held `margin` inside the window. A point anchor (a right-click) has no size.
 */
export function placeNear(
  anchor: Box,
  size: { width: number; height: number },
  view: { width: number; height: number },
  gap = 4,
  margin = 16,
): { left: number; top: number } {
  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - size.height;
  const top = below + size.height <= view.height - margin || above < margin ? below : above;
  const left = Math.min(anchor.left, view.width - margin - size.width);
  return {
    left: Math.max(margin, left),
    top: Math.max(margin, Math.min(top, view.height - margin - size.height)),
  };
}

/**
 * The control focus moves to among `count` in a row or column after an arrow
 * key, from `at`, wrapping; null for any other key. Home and End go to the ends.
 */
export function rovingStep(key: string, at: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (at + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (at - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
