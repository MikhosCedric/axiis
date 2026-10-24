"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { LocalDate } from "@/domain/item";
import { useClock } from "@/components/shell/clock-context";
import { gridStep } from "@/features/month/grid-step";
import { formatDayHeading } from "@/features/today/format";
import { Glyph } from "@/features/today/glyph";
import { formatMinutes } from "@/lib/clock";
import { SAMPLE_MARKS_PER_DAY, sampleMarks, type SampleMark } from "./month-sample";
import styles from "./demos.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const noop = () => () => {};
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * This month's grid with made-up marks. Resting the pointer on a day, or moving to it with the
 * Month's keys, lists that day beside the grid. The server lays the grid out; the browser finds today.
 */
export function MonthDemo({ days, month, title }: { days: LocalDate[]; month: string; title: string }) {
  const clock = useClock();
  const today = useSyncExternalStore(noop, localToday, () => null);
  const startAt = Math.max(0, days.findIndex((d) => d === `${month}-14`));
  const [focused, setFocused] = useState(startAt);
  const [hovered, setHovered] = useState<number | null>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const shown = days[hovered ?? focused];
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  function move(key: string, index: number) {
    const step = gridStep(key, index);
    if (!step || !("days" in step)) return false;
    const next = Math.max(0, Math.min(days.length - 1, index + step.days));
    setFocused(next);
    setHovered(null);
    cells.current[next]?.focus();
    return true;
  }

  const state = (date: LocalDate) => (today !== null && date < today ? "done" : "planned");

  return (
    <div className={styles.monthDemo}>
      <div
        role="grid"
        aria-label={title}
        className={styles.monthGrid}
        onPointerLeave={() => setHovered(null)}
      >
        <div role="row" className={styles.monthWeek}>
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className={styles.weekday}>
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={week[0]} role="row" className={styles.monthWeek}>
            {week.map((date, i) => {
              const index = w * 7 + i;
              const marks = sampleMarks(date);
              const out = !date.startsWith(month);
              const number = Number(date.slice(8));
              return (
                <div
                  key={date}
                  ref={(el) => {
                    cells.current[index] = el;
                  }}
                  role="gridcell"
                  tabIndex={index === focused ? 0 : -1}
                  aria-selected={index === focused}
                  className={`${styles.day} ${out ? styles.dayOut : ""} ${index === (hovered ?? focused) ? styles.dayShown : ""}`}
                  onPointerEnter={() => setHovered(index)}
                  onClick={() => setFocused(index)}
                  onFocus={() => setFocused(index)}
                  onKeyDown={(e) => {
                    if (move(e.key, index)) e.preventDefault();
                  }}
                >
                  <span className="sr-only">
                    {formatDayHeading(date)}, {marks.length === 0 ? "nothing planned" : marks.length === 1 ? "1 item" : `${marks.length} items`}
                  </span>
                  <span className={`${styles.dayNumber} tabular ${date === today ? styles.today : ""}`} aria-hidden="true">
                    {number}
                    {number === 1 && <span className={styles.dayMonth}> {SHORT_MONTH.format(new Date(`${date}T00:00:00Z`))}</span>}
                  </span>
                  <span className={styles.marks} aria-hidden="true">
                    {marks.slice(0, SAMPLE_MARKS_PER_DAY).map((m) => (
                      <span key={m.title} className={styles.mark}>
                        <Glyph type="task" state={state(date)} className={styles.markGlyph} />
                        <span className={styles.markWords}>
                          {m.due ? "Due " : m.at !== null && <span className="text-ink-3 tabular">{formatMinutes(m.at, clock)} </span>}
                          {m.title}
                        </span>
                      </span>
                    ))}
                    {marks.length > SAMPLE_MARKS_PER_DAY && <span className={styles.more}>+{marks.length - SAMPLE_MARKS_PER_DAY} more</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <DayList date={shown} marks={sampleMarks(shown)} state={state(shown)} clock={clock} />
    </div>
  );
}

function DayList({ date, marks, state, clock }: { date: LocalDate; marks: SampleMark[]; state: "done" | "planned"; clock: "12" | "24" }) {
  return (
    <section className={styles.dayList} aria-label="The day shown">
      <h4 className="font-serif text-[18px] font-medium text-ink">{formatDayHeading(date)}</h4>
      {marks.length === 0 ? (
        <p className="mt-2 text-ink-3">Nothing planned.</p>
      ) : (
        <ul className="mt-2">
          {marks.map((m) => (
            <li key={m.title} className={styles.dayListRow}>
              <Glyph type="task" state={state} />
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              <span className="text-ink-3 tabular">{m.due ? "Due" : m.at === null ? "Any time" : formatMinutes(m.at, clock)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
