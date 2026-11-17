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
 *
 * A calendar view passes `inline`: on a wide page the head is one compact bar, so the grid gets the
 * height. Today and the steps, then the title with its summary as a quiet second line, the capture
 * field in the room that is left, and the controls last. Narrower, it is the stack above.
 */
export function PageHeader({
  heading,
  controls,
  controlsRow = false,
  capture,
  inline = false,
  children,
}: {
  /** An `h1`, or the calendar bar, which carries the `h1` itself. */
  heading: ReactNode;
  controls?: ReactNode;
  /** On a phone, the controls take one compact row of their own under the title, instead of sharing its row. */
  controlsRow?: boolean;
  capture?: ReactNode;
  /** One bar on a wide page (a calendar view). */
  inline?: boolean;
  /** The summary line and the filter chips. */
  children?: ReactNode;
}) {
  return (
    <header
      className={
        inline
          ? "@min-[64rem]/page:mb-5 @min-[64rem]/page:grid @min-[64rem]/page:grid-cols-[auto_fit-content(24rem)_minmax(18rem,1fr)_auto] @min-[64rem]/page:items-center @min-[64rem]/page:gap-x-5"
          : undefined
      }
    >
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 max-rail:gap-x-2 ${inline ? "@min-[64rem]/page:contents" : ""}`}>
        {heading}
        {controls && (
          <div
            className={`ml-auto flex flex-none items-center gap-2 @max-[56rem]/page:order-2 max-rail:order-3! ${controlsRow ? "max-rail:ml-0! max-rail:basis-full max-rail:justify-between" : ""} ${inline ? "@min-[64rem]/page:col-start-4 @min-[64rem]/page:row-span-2 @min-[64rem]/page:row-start-1" : ""}`}
          >
            {controls}
          </div>
        )}
      </div>
      {inline ? <div className="min-w-0 @min-[64rem]/page:col-start-2 @min-[64rem]/page:row-start-2 @min-[64rem]/page:[&_.page-summary]:mt-0.5">{children}</div> : children}
      {capture && (
        <div
          className={`mt-5 mb-3 max-w-[440px] max-rail:mt-3 max-rail:mb-2 ${inline ? "@min-[64rem]/page:col-start-3 @min-[64rem]/page:row-span-2 @min-[64rem]/page:row-start-1 @min-[64rem]/page:my-0 @min-[64rem]/page:max-w-none @min-[64rem]/page:self-center" : ""}`}
        >
          {capture}
        </div>
      )}
    </header>
  );
}
