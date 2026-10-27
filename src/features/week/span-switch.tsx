import { Segmented } from "@/components/segmented";
import type { Span } from "./span";

const SPANS: { span: Span; label: string }[] = [
  { span: "day", label: "Day" },
  { span: "week", label: "Week" },
  { span: "month", label: "Month" },
];

/**
 * The one switch between the day, the week and the month that hold the same
 * date, first in the steps row of all three. The current one is marked, not
 * linked away from; choosing another slides the thumb there as the page turns.
 */
export function SpanSwitch({ current, hrefs }: { current: Span; hrefs: Record<Span, string> }) {
  return (
    <Segmented
      label="Day, week or month"
      chosen={current}
      segments={SPANS.map(({ span, label }) => ({ key: span, label, href: hrefs[span] }))}
      className="h-9 pointer-coarse:h-12"
    />
  );
}
