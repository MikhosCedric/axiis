import type { ReactNode } from "react";

/**
 * The head of every signed-in page, one structure everywhere (ADR-0004):
 *
 * 1. the top row: the page's title (on a calendar view, the calendar bar that holds it) and, at
 *    its trailing end, the page's own controls, the Guide always last;
 * 2. what the page holds, in a sentence, and the filter it is narrowed to;
 * 3. the page's capture, always on its own row under those.
 *
 * So Today, the steps, a view switch, the Guide and capture are each in one spot on every page.
 */
export function PageHeader({
  heading,
  controls,
  controlsRow = false,
  capture,
  children,
}: {
  /** An `h1`, or the calendar bar, which carries the `h1` itself. */
  heading: ReactNode;
  controls?: ReactNode;
  /** On a phone, the controls take one compact row of their own under the title, instead of sharing its row. */
  controlsRow?: boolean;
  capture?: ReactNode;
  /** The summary line and the filter chips. */
  children?: ReactNode;
}) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-rail:gap-x-2">
        {heading}
        {controls && (
          <div className={`ml-auto flex flex-none items-center gap-2 @max-[56rem]/page:order-2 max-rail:order-3! ${controlsRow ? "max-rail:ml-0! max-rail:basis-full max-rail:justify-between" : ""}`}>
            {controls}
          </div>
        )}
      </div>
      {children}
      {capture && <div className="mt-5 mb-3 max-w-[440px] max-rail:mt-3 max-rail:mb-2">{capture}</div>}
    </header>
  );
}
