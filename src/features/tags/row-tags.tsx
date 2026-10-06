import { tagLine } from "./model";

/**
 * A row's tags in quiet text after its title. Screen readers hear "tagged
 * home and errands"; the visible "#home #errands" is hidden from them. Rows
 * whose label is an `aria-label` add `tagLine(...).spoken` to it instead.
 */
export function RowTags({ tags, max, className = "ml-1.5" }: { tags: readonly string[] | undefined; max?: number; className?: string }) {
  const line = tagLine(tags ?? [], max);
  if (!line.shown) return null;
  return (
    <span className={`text-[13px] font-normal text-ink-3 ${className}`}>
      <span aria-hidden="true">{line.shown}</span>
      <span className="sr-only">, {line.spoken}</span>
    </span>
  );
}
