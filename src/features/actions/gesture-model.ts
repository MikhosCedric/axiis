/** Distances in CSS pixels and times in milliseconds for a row's swipe and long press. */
export const SWIPE = {
  /** How far a finger moves before the gesture is a swipe or a scroll. */
  decide: 10,
  /** How far right ticks it. */
  done: 72,
  /** How far left leaves Plan and Delete showing. */
  reveal: 56,
  /** How wide Plan and Delete stand once shown. */
  open: 152,
  /** How long a still finger waits before the menu opens. */
  longPress: 500,
  /** How far a finger may drift and still be a long press. */
  slop: 8,
} as const;

/**
 * Which way a touch is going, once it has gone far enough to say: "x" is a
 * swipe of the row, "y" a scroll of the page, which the row leaves alone.
 * A move mostly sideways (more than 1.2 times as far across as down) is a swipe.
 */
export function swipeAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < SWIPE.decide) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
}

/** What a swipe that ended `dx` across does: tick it, leave Plan and Delete showing, or nothing. */
export function swipeEnd(dx: number): "done" | "open" | "close" {
  if (dx >= SWIPE.done) return "done";
  if (dx <= -SWIPE.reveal) return "open";
  return "close";
}

/**
 * How wide the strip that follows the finger is drawn: as far as the finger
 * went, then half as far again past the point where letting go would act, so
 * it slows under the finger instead of running to the edge.
 */
export function swipeReach(dx: number): number {
  const far = Math.abs(dx);
  const limit = dx >= 0 ? SWIPE.done * 1.5 : SWIPE.open;
  return far <= limit ? far : limit + (far - limit) / 2;
}
