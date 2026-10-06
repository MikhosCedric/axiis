import { tagLine } from "./model";

/**
 * A row's tags in quiet text after its title. Screen readers hear "tagged
 * home and errands"; the visible "#home #errands" is hidden from them. Rows
 * whose label is an `aria-label` add `tagLine(...).spoken` to it instead.
 */
export function RowTags({
  tags,
  max,
  className = "ml-1.5",
  selected = false,
}: {
  tags: readonly string[] | undefined;
  max?: number;
  className?: string;
  /** The row sits on the accent wash, where the quietest ink is too faint to read. */
  selected?: boolean;
}) {
  const line = tagLine(tags ?? [], max);
  if (!line.shown) return null;
  return (
    <span className={`text-[13px] font-normal ${selected ? "text-ink-2" : "text-ink-3"} ${className}`}>
      <span aria-hidden="true">{line.shown}</span>
      <span className="sr-only">, {line.spoken}</span>
    </span>
  );
}
