"use client";

import Link from "next/link";
import type { LocalDate } from "@/domain/item";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { formatDayHeading } from "@/features/today/format";
import { weekdayName } from "@/features/week/model";
import { dayHref } from "./nav";
import type { PulseData } from "./pulse";

/**
 * The week in one glance: a ring per day filling as that day's items get done, today inked, and one
 * line of progress above them. It answers "how is my week going", which the day's own line does not,
 * and each ring is a way into that day. Shown beside Today on wide screens only.
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
          const fill = d.total ? d.done / d.total : 0;
          return (
            <li key={d.date} className="grid justify-items-center gap-1">
              <Link
                href={keep(dayHref(d.date, today, "score"))}
                title={`Open ${formatDayHeading(d.date)}`}
                className="grid justify-items-center gap-1 rounded-lg px-1 py-1 hover:bg-hover active:bg-press"
              >
                <span className={`text-xs ${isToday ? "font-semibold text-ink" : "text-ink-3"}`} aria-hidden="true">
                  {weekdayName(d.date, "short").slice(0, 1)}
                </span>
                <Ring fill={fill} empty={d.total === 0} today={isToday} />
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

function Ring({ fill, empty, today }: { fill: number; empty: boolean; today: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={26} height={26} className={today ? "text-ink" : "text-ink-2"}>
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth={2} opacity={empty ? 0.18 : 0.28} strokeDasharray={empty ? "2 3" : undefined} />
      {!empty && fill > 0 && (
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray={`${c * fill} ${c}`}
          transform="rotate(-90 12 12)"
        />
      )}
      {today && <circle cx="12" cy="12" r="2.2" fill="currentColor" />}
    </svg>
  );
}
