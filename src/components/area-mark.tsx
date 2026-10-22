import type { AreaColor } from "@/domain/area-color";

/**
 * An area's colour as a dot (8px unless `size` says otherwise) beside its name, or nothing for None.
 * Decoration only: the name beside it carries the area, so the dot is hidden from assistive tech.
 * `done` draws it hollow, like a done glyph.
 */
export function AreaMark({
  color,
  done = false,
  size = 8,
  className = "",
}: {
  color: AreaColor | null;
  done?: boolean;
  size?: number;
  className?: string;
}) {
  if (color === null) return null;
  const value = `var(--area-${color})`;
  return (
    <span
      aria-hidden="true"
      data-area-color={color}
      className={`inline-block flex-none rounded-full border-[1.5px] ${className}`}
      style={{ width: size, height: size, borderColor: value, backgroundColor: done ? "transparent" : value }}
    />
  );
}

/** An area's name in a row's metadata, led by its dot. */
export function AreaLabel({ name, color, className = "" }: { name: string; color: AreaColor | null; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <AreaMark color={color} />
      <span className="truncate">{name}</span>
    </span>
  );
}
