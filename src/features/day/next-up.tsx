"use client";

import { useId, useState } from "react";
import { MotionList } from "@/components/motion-list";
import { quickItem } from "@/features/actions/quick-item";
import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";
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
export function GlanceLine({ glance, timeZone, scope }: { glance: DayGlance; timeZone: string; scope?: string }) {
  const clock = useClock();
  const share = glance.total ? glance.done / glance.total : 0;
  return (
    <>
      <p className="page-summary max-rail:mt-2 max-rail:line-clamp-2 max-rail:text-sm" data-glance>
        {glanceLine(glance, (d) => formatClock(d, timeZone, clock), scope)}
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

/** The one line the strip says on a phone: "Now: Inbox · next: Call the landlord 12:00". */
function stripWords(entries: TodayEntry[], timeZone: string, clock: ReturnType<typeof useClock>, titleOf: (e: TodayEntry) => string) {
  const live = entries.filter((e) => e.state === "live");
  const later = entries.filter((e) => e.state !== "live" && e.state !== "done");
  const at = (e: TodayEntry) => (e.item.schedule.kind === "timed" ? ` ${formatClock(e.item.schedule.start, timeZone, clock)}` : "");
  const parts: string[] = [];
  if (live.length > 0) parts.push(`Now: ${titleOf(live[0])}${live.length > 1 ? ` and ${live.length - 1} more` : ""}`);
  if (later.length > 0) parts.push(`${parts.length ? "next" : "Next"}: ${titleOf(later[0])}${at(later[0])}`);
  return parts.length > 0 ? parts.join(" · ") : "Next up";
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
  const quick = useQuick();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (entries.length === 0) return null;
  const titleOf = (e: TodayEntry) => quick?.patched(e.item.id)?.title ?? e.item.title;
  return (
    <section aria-labelledby="next-up-h" className="side-part mb-4 max-w-[720px] rail:mb-7 @min-[66rem]/page:px-4 @min-[66rem]/page:py-3.5">
      {/* A phone: one line that opens the card, so the grid starts high on the screen. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="press flex min-h-11 w-full items-center gap-2 rounded-lg border border-rule bg-sheet px-3 text-left text-[13px] font-medium text-ink hover:bg-hover active:bg-press rail:hidden"
      >
        <span className="sr-only">Next up: </span>
        <span className="min-w-0 flex-1 truncate">{stripWords(entries, timeZone, clock, titleOf)}</span>
        <svg viewBox="0 0 18 18" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`flex-none text-ink-3 ${open ? "rotate-180" : ""}`}>
          <path d="M4 7l5 5 5-5" />
        </svg>
      </button>
      <div id={bodyId} className={open ? "" : "max-rail:hidden"}>
      <h2 id="next-up-h" className="font-display text-lg leading-tight font-medium max-rail:mt-3">
        Next up
      </h2>
      <MotionList className="surface side-part overflow-hidden px-3 py-1.5 [&_li:last-child]:border-b-0 mt-2.5 @min-[66rem]/page:px-0 @min-[66rem]/page:py-0">
        {entries.map((entry) => {
          const { item, state } = entry;
          const area = areas.find((a) => a.id === item.areaId);
          const patch = quick?.patched(item.id);
          if (patch?.hidden) return null;
          const title = patch?.title ?? item.title;
          const qi = { ...quickItem(item, timeZone), title };
          const hooks = { onOpen: () => onSelect(item.id), onToggleDone: () => onToggleDone(item), inlineRename: "next-up", doneBox: true };
          return (
            <li
              key={item.id}
              data-next={item.id}
              {...rowProps(quick, qi, hooks)}
              className="group/row relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[48px_minmax(0,1fr)_auto]"
            >
              <span className="-my-1 grid place-items-center">
                <DoneToggle type={item.type} title={title} done={state === "done"} justDone={justDone === item.id} onToggle={() => onToggleDone(item)} />
              </span>
              <div className="min-w-0">
                {quick?.renaming === renameKey("next-up", item.id) ? (
                  <RenameField item={qi} className="font-medium" />
                ) : (
                <button
                  type="button"
                  data-quick-focus
                  onClick={() => onSelect(item.id)}
                  className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${state === "live" ? "font-bold text-ink" : "font-medium text-ink"}`}
                >
                  {title}
                </button>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span className={`tabular ${state === "live" ? "font-semibold text-accent" : ""}`}>{whenWords(entry, timeZone, clock)}</span>
                  {item.dueOn && <DueMark dueOn={item.dueOn} today={date} />}
                  {area && <AreaLabel name={area.name} color={area.color} />}
                </p>
              </div>
              <RowActions item={qi} hooks={hooks} className="quick-over" />
            </li>
          );
        })}
      </MotionList>
      </div>
    </section>
  );
}
