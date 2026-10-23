import Link from "next/link";
import type { Span } from "./span";

const SPANS: { span: Span; label: string }[] = [
  { span: "day", label: "Day" },
  { span: "week", label: "Week" },
  { span: "month", label: "Month" },
];

/**
 * The one switch between the day, the week and the month that hold the same
 * date, first in the steps row of all three. The current one is marked, not
 * linked away from.
 */
export function SpanSwitch({ current, hrefs }: { current: Span; hrefs: Record<Span, string> }) {
  return (
    <div role="group" aria-label="Day, week or month" className="inline-flex h-9 flex-none overflow-hidden rounded-md border border-rule pointer-coarse:h-11">
      {SPANS.map(({ span, label }) => (
        <Link
          key={span}
          href={hrefs[span]}
          aria-current={current === span ? "page" : undefined}
          className={`inline-flex h-full items-center px-3 font-medium ${
            current === span ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
