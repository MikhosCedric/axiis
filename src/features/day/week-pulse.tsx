"use client";

import Link from "next/link";
import type { LocalDate } from "@/domain/item";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { formatDayHeading } from "@/features/today/format";
import { weekdayName } from "@/features/week/model";
import { dayHref } from "./nav";
import type { PulseData } from "./pulse";

/**
 * The week in one glance: each day's done and planned counts, today marked, and one
 * line of progress above them. It answers "how is my week going", which the day's own line does not,
 * and each day is a way into it. Shown beside Today on wide screens only.
 */
export function WeekPulse({ pulse, today }: { pulse: PulseData; today: LocalDate }) {
  const keep = useKeepFilter();
  const share = pulse.total ? pulse.done / pulse.total : 0;
  return (
    <section aria-labelledby="pulse-h" className="surface px-4 py-3.5">
      <h2 id="pulse-h" className="font-display text-lg leading-tight font-medium">
        This week
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-3">{pulse.total === 0 ? "Nothing planned yet." : `${pulse.done} of ${pulse.total} done`}</p>
      {pulse.total > 0 && (
        <div aria-hidden="true" className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-hover">
          <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
      <ul className="mt-3.5 grid grid-cols-7 gap-1">
        {pulse.days.map((d) => {
          const isToday = d.date === today;
          const complete = d.total > 0 && d.done === d.total;
          return (
            <li key={d.date}>
              <Link
                href={keep(dayHref(d.date, today, "score"))}
                title={`Open ${formatDayHeading(d.date)}`}
                className={`grid justify-items-center gap-0.5 rounded-lg py-1.5 hover:bg-hover active:bg-press ${isToday ? "bg-hover" : ""}`}
              >
                <span className={`text-xs ${isToday ? "font-semibold text-ink" : "text-ink-3"}`} aria-hidden="true">
                  {weekdayName(d.date, "short").slice(0, 1)}
                </span>
                <span aria-hidden="true" className={`text-[13px] tabular ${d.total === 0 ? "text-ink-3" : complete ? "font-semibold text-ink" : "text-ink-2"}`}>
                  {d.total === 0 ? "·" : `${d.done}/${d.total}`}
                </span>
                <span className="sr-only">
                  {formatDayHeading(d.date)}: {d.total === 0 ? "nothing planned" : `${d.done} of ${d.total} done`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
