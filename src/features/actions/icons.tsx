import type { QuickIconName } from "./icon-sprite";

/** One of the drawings in `QuickIconSprite`, which the app layout sends once as HTML. */
export function QuickIcon({ name }: { name: QuickIconName }) {
  return (
    <svg width={16} height={16} aria-hidden="true" className="flex-none">
      <use href={`#qa-${name}`} />
    </svg>
  );
}
