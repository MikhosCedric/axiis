import type { AreaColor } from "@/domain/area-color";

/**
 * An area's colour as an 8px dot beside its name, or nothing for None. Decoration only: the name beside it
 * carries the area, so the dot is hidden from assistive tech. `done` draws it hollow, like a done glyph.
 */
export function AreaMark({ color, done = false, className = "" }: { color: AreaColor | null; done?: boolean; className?: string }) {
  if (color === null) return null;
  const value = `var(--area-${color})`;
  return (
    <span
      aria-hidden="true"
      data-area-color={color}
      className={`inline-block size-2 flex-none rounded-full border-[1.5px] ${className}`}
      style={{ borderColor: value, backgroundColor: done ? "transparent" : value }}
    />
  );
}
