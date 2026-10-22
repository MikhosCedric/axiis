"use client";

import { AreaLabel } from "@/components/area-mark";
import { ProgressLine } from "@/components/progress-line";
import { useClock } from "@/components/shell/clock-context";
import type { Area, LocalDate, ShownItem } from "@/domain/item";
import { DueMark } from "@/features/today/due-mark";
import { DoneToggle } from "@/features/today/done-toggle";
import type { TodayEntry } from "@/features/today/model";
import { formatClock } from "@/lib/clock";
import { glanceLine, type DayGlance } from "./glance";

/** The line under a day's date: where the day is, how far through it you are and what comes next, with a ruled progress line. */
export function GlanceLine({ glance, timeZone }: { glance: DayGlance; timeZone: string }) {
  const clock = useClock();
  const share = glance.total ? glance.done / glance.total : 0;
  return (
    <>
      <p className="page-summary" data-glance>
        {glanceLine(glance, (d) => formatClock(d, timeZone, clock))}
      </p>
      {glance.total > 0 && <ProgressLine share={share} className="mt-2.5 w-40 text-ink-2" />}
    </>
  );
}

/** When an entry happens, in words: "now, until 15:00", "16:00 to 17:00", "at 18:00", "any time". */
function whenWords(entry: TodayEntry, timeZone: string, clock: ReturnType<typeof useClock>) {
  const s = entry.item.schedule;
  if (s.kind !== "timed") return "Any time";
  const from = formatClock(s.start, timeZone, clock);
  const to = formatClock(s.end, timeZone, clock);
  if (entry.state === "live") return `Now, until ${to}`;
  return entry.item.type === "event" ? `${from} to ${to}` : `At ${from}`;
}

/**
 * The next one to three things on today, each with its done tick. The calm top of Today: what to do now,
 * not everything there is.
 */
export function NextUp({
  entries,
  date,
  timeZone,
  areas,
  justDone,
  onSelect,
  onToggleDone,
}: {
  entries: TodayEntry[];
  date: LocalDate;
  timeZone: string;
  areas: Area[];
  justDone: string | null;
  onSelect: (id: string) => void;
  onToggleDone: (item: ShownItem) => void;
}) {
  const clock = useClock();
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="next-up-h" className="mb-6 max-w-[760px]">
      <h2 id="next-up-h" className="font-serif text-lg leading-tight font-medium">
        Next up
      </h2>
      <ul className="mt-2 border-t border-rule">
        {entries.map((entry) => {
          const { item, state } = entry;
          const area = areas.find((a) => a.id === item.areaId);
          return (
            <li
              key={item.id}
              data-next={item.id}
              className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y)"
            >
              <span className="-my-1 grid place-items-center">
                <DoneToggle type={item.type} title={item.title} done={state === "done"} justDone={justDone === item.id} onToggle={() => onToggleDone(item)} />
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${state === "live" ? "font-bold text-ink" : "font-medium text-ink"}`}
                >
                  {item.title}
                </button>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span className={`tabular ${state === "live" ? "font-semibold text-accent" : ""}`}>{whenWords(entry, timeZone, clock)}</span>
                  {item.dueOn && <DueMark dueOn={item.dueOn} today={date} />}
                  {area && <AreaLabel name={area.name} color={area.color} />}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
