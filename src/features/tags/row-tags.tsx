"use client";

import { AreaMark } from "@/components/area-mark";
import { tagLine } from "./model";
import { useTagColor } from "./tag-colors";

/**
 * A row's tags in quiet text after its title, each coloured one led by its dot. Screen readers
 * hear "tagged home and errands"; the visible "#home #errands" is hidden from them. Rows
 * whose label is an `aria-label` add `tagLine(...).spoken` to it instead.
 */
export function RowTags({
  tags,
  max = 3,
  className = "ml-1.5",
  selected = false,
}: {
  tags: readonly string[] | undefined;
  max?: number;
  className?: string;
  /** The row sits on the accent wash, where the quietest ink is too faint to read. */
  selected?: boolean;
}) {
  const colorOf = useTagColor();
  const all = tags ?? [];
  const line = tagLine(all, max);
  if (!line.shown) return null;
  const rest = all.length - max;
  return (
    <span className={`text-[13px] font-normal ${selected ? "text-ink-2" : "text-ink-3"} ${className}`}>
      <span aria-hidden="true" className="inline-flex flex-wrap items-center gap-x-1.5">
        {all.slice(0, max).map((name) => (
          <span key={name} className="inline-flex items-center gap-1">
            <AreaMark color={colorOf(name)} size={6} />#{name}
          </span>
        ))}
        {rest > 0 && <span>+{rest}</span>}
      </span>
      <span className="sr-only">, {line.spoken}</span>
    </span>
  );
}
