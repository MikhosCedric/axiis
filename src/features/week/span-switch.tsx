import Link from "next/link";

/** Links between the day and the week holding it. The current one is marked, not linked away from. */
export function SpanSwitch({ current, dayHref, weekHref }: { current: "day" | "week"; dayHref: string; weekHref: string }) {
  const tab = (span: "day" | "week", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === span ? "page" : undefined}
      className={`inline-flex h-full items-center px-3 font-medium ${
        current === span ? "bg-ink text-paper" : "text-ink-2 hover:bg-accent-wash"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div role="group" aria-label="Day or week" className="inline-flex h-9 flex-none overflow-hidden rounded-md border border-rule pointer-coarse:h-11">
      {tab("day", dayHref, "Day")}
      {tab("week", weekHref, "Week")}
    </div>
  );
}
