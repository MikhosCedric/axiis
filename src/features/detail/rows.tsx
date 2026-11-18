import type { ReactNode } from "react";

/**
 * One line of the panel: a 16px icon in a fixed column and the value beside
 * it, so every value starts at the same left edge. The icon is decoration; the
 * control in the value carries the name.
 */
export function Row({ icon, children, className = "" }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-h-9 grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-3 pointer-coarse:min-h-11 ${className}`}>
      <span aria-hidden="true" className="grid h-9 place-items-center text-ink-3 pointer-coarse:h-11">
        {icon}
      </span>
      <div className="flex min-h-9 min-w-0 items-center pointer-coarse:min-h-11">
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** A value that opens something, drawn as plain text until it is hovered or focused. */
export const rowButton =
  "-ml-2 flex min-h-9 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-2 text-left text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11";

/** A small bordered field for a time or a date. */
export const smallField =
  "h-8 rounded-md border border-rule-soft bg-transparent px-1.5 text-ink tabular hover:border-rule focus:border-field focus:bg-sheet pointer-coarse:h-11";

/** The same field on a bare page, such as a select in the repeat editor. */
export const editorField =
  "h-8 max-w-full rounded-md border border-rule-soft bg-transparent px-1.5 text-ink hover:border-rule focus:border-field focus:bg-sheet pointer-coarse:h-11";
