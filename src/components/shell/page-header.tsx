import type { ReactNode } from "react";

/**
 * The head of every signed-in page, one structure everywhere (ADR-0004), laid out by the
 * `page-header` utility in `globals.css` as a grid of named slots:
 *
 * - the title (an `h1`; on a calendar view, the calendar bar's Today and steps plus the title);
 * - the summary line and the filter it is narrowed to, under the title;
 * - the page's own controls, the Guide always last;
 * - the page's capture, with its status and preview line in room of its own.
 *
 * Narrow, those stack; wider, the title row holds the steps, the title and the controls with
 * capture on its own row under it. Only a calendar view with room to spare (`inline`, a page
 * container of 90rem or more) puts capture between the title and the controls, and then the
 * head keeps the line under the capture as padding of its own, so nothing hangs below the bar.
 */
export function PageHeader({
  heading,
  controls,
  capture,
  bar = false,
  inline = false,
  children,
}: {
  /** An `h1`, or the calendar bar, which carries the `h1` and its steps itself. */
  heading: ReactNode;
  controls?: ReactNode;
  capture?: ReactNode;
  /** A calendar view: the heading brings Today and the steps. */
  bar?: boolean;
  /** Where the page is wide enough, capture goes between the title and the controls. */
  inline?: boolean;
  /** The summary line and the filter chips. */
  children?: ReactNode;
}) {
  return (
    <header className="page-header" data-bar={bar ? "" : undefined} data-inline={bar && inline ? "" : undefined}>
      {heading}
      {children && <div data-slot="sum">{children}</div>}
      {controls && (
        <div data-slot="ctl" className="flex flex-none items-center gap-2">
          {controls}
        </div>
      )}
      {capture && <div data-slot="cap">{capture}</div>}
    </header>
  );
}
