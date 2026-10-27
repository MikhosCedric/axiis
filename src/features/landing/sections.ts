/**
 * The story's five movements, in page order: the table the header's letters, the contents rail and the
 * movements themselves all read, so a letter, its link and its section never disagree.
 */
export const SECTIONS = [
  { id: "capture", letter: "A", name: "Capture", tempo: "Presto" },
  { id: "drag", letter: "B", name: "Drag", tempo: "Andante" },
  { id: "done", letter: "C", name: "Done", tempo: "Fine" },
  { id: "focus", letter: "D", name: "Focus", tempo: "Tranquillo" },
  { id: "month", letter: "E", name: "Month", tempo: "Largo" },
] as const;

export type Section = (typeof SECTIONS)[number];

type Span = { top: number; bottom: number };

/**
 * The section a reader is in: the first, in page order, whose box spans the probe line (a height in the
 * viewport, measured from its top). -1 above the first, below the last, or in a gap between two.
 */
export function currentSection(boxes: readonly Span[], probe: number): number {
  return boxes.findIndex((box) => box.top <= probe && box.bottom > probe);
}
