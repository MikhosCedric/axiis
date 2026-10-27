"use client";

import { ViewTransition } from "react";
import { AreaLabel } from "@/components/area-mark";
import { repeats, type Area, type LocalDate, type ShownItem } from "@/domain/item";
import { DueMark } from "@/features/today/due-mark";
import { DoneFold } from "./score-view";
import { RepeatMark } from "@/features/today/repeat-mark";
import { RowTags } from "@/features/tags/row-tags";
import { formatClock } from "@/lib/clock";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import { SameInInbox } from "@/features/inbox/same-in-inbox";
import { EMPTY_TRAY, TRAY_FULL, INBOX,type BeamState, type TodayEntry, type TodayView } from "@/features/today/model";
import type { ChildCount } from "@/lib/items/repo";
import { quickItem } from "@/features/actions/quick-item";
import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";

const TITLE_WEIGHT: Record<BeamState, string> = {
  planned: "font-medium text-ink",
  live: "font-bold text-ink",
  done: "font-normal",
};

export function ListView({
  view,
  today,
  waitingFull,
  areas,
  timeZone,
  childCounts,
  tags,
  selectedId,
  justDone,
  onSelect,
  onToggleDone,
}: {
  view: TodayView;
  /** The real today, for due marks. */
  today: LocalDate;
  waitingFull: boolean;
  areas: Area[];
  timeZone: string;
  childCounts: Record<string, ChildCount>;
  tags: Record<string, readonly string[]>;
  selectedId: string | null;
  justDone: string | null;
  onSelect: (id: string | null) => void;
  onToggleDone: (item: ShownItem) => void;
}) {
  const clock = useClock();
  const quick = useQuick();
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));
  const row = ({ item, state: saved }: TodayEntry) => {
    const patch = quick?.patched(item.id);
    if (patch?.hidden) return null;
    const state = patch?.done === undefined ? saved : patch.done ? "done" : saved === "done" ? "planned" : saved;
    const title = patch?.title ?? item.title;
    const qi = { ...quickItem(item, timeZone), title };
    const hooks = { onOpen: () => onSelect(item.id), onToggleDone: () => onToggleDone(item), inlineRename: "list", doneBox: true, swipe: true };
    const count = childCounts[item.id];
    const s = item.schedule;
    const selected = selectedId === item.id;
    const area = item.areaId ? areaOf.get(item.areaId) : undefined;
    // The quietest ink is too faint to read on the accent wash of a selected row.
    const quiet = selected ? "text-ink-2" : "text-ink-3";
    return (
      <li
        key={item.id}
        data-item={item.id}
        {...rowProps(quick, qi, hooks)}
        className={`group/row relative grid grid-cols-[4.5rem_48px_minmax(0,1fr)] items-center gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[4.5rem_48px_minmax(0,1fr)_auto] rail:grid-cols-[minmax(6.5rem,auto)_48px_minmax(0,1fr)_auto] rail:pointer-coarse:grid-cols-[minmax(6.5rem,auto)_48px_minmax(0,1fr)_auto_auto] ${
          selected ? "row-selected" : ""
        }`}
      >
        <span className="pl-1 text-ink-2 tabular">
          {s.kind === "timed" ? (
            <>
              <time dateTime={s.start.toISOString()}>{formatClock(s.start, timeZone, clock)}</time>
              <span className="max-rail:hidden">
                {" to "}
                <time dateTime={s.end.toISOString()}>{formatClock(s.end, timeZone, clock)}</time>
              </span>
            </>
          ) : (
            <span className={quiet}>{s.kind === "day" ? "Any time" : INBOX}</span>
          )}
        </span>
        <label className="relative grid h-8 w-12 cursor-pointer place-items-center rounded-md hover:bg-hover active:bg-press has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <input
            type="checkbox"
            className="sr-only"
            checked={state === "done"}
            onChange={() => onToggleDone(item)}
            aria-label={`Done: ${title}`}
          />
          <ViewTransition name={`item-${item.id}`} share="morph" default="none">
            <Glyph type={item.type} state={state} justDone={justDone === item.id} />
          </ViewTransition>
        </label>
        {quick?.renaming === renameKey("list", item.id) ? (
          <RenameField item={qi} className={TITLE_WEIGHT[state]} />
        ) : (
        <button
          type="button"
          data-quick-focus
          aria-pressed={selected}
          onClick={() => onSelect(item.id)}
          className={`min-w-0 cursor-pointer rounded text-left break-words hover:underline ${TITLE_WEIGHT[state]} ${
            state === "done" ? quiet : ""
          }`}
        >
          {title}
          {repeats(item) && (
            <>
              <RepeatMark className={`ml-1.5 ${quiet}`} />
              <span className="sr-only">, repeats</span>
            </>
          )}
          {count && (
            <span className="ml-1.5 font-normal text-ink-2 tabular">
              <span aria-hidden="true">
                {count.done}/{count.total}
              </span>
              <span className="sr-only">
                , {count.done} of {count.total} subtasks done
              </span>
            </span>
          )}
          <RowTags tags={tags[item.id]} selected={selected} />
          {item.dueOn && state !== "done" && <DueMark dueOn={item.dueOn} today={today} className={`ml-2 text-xs ${quiet}`} />}
        </button>
        )}
        <span className={`pr-1 text-[13px] max-rail:hidden ${quiet}`}>
          {area && <AreaLabel name={area.name} color={area.color} />}
        </span>
        <RowActions item={qi} hooks={hooks} className="quick-over" />
      </li>
    );
  };

  /** Open rows, then the done ones folded under one quiet line. A row just ticked or open in the panel stays put. */
  const rows = (entries: TodayEntry[]) => {
    const done = entries.filter((e) => e.state === "done" && e.item.id !== justDone && e.item.id !== selectedId);
    return (
      <>
        <ul>{entries.filter((e) => !done.includes(e)).map(row)}</ul>
        {done.length > 0 && (
          <div className="pt-2">
            <DoneFold count={done.length} listClassName="mt-1">
              {done.map(row)}
            </DoneFold>
          </div>
        )}
      </>
    );
  };

  return (
    <section aria-labelledby="list-h">
      <h2 id="list-h" className="sr-only">
        List
      </h2>
      <h3 className="border-b border-rule pb-2.5 font-serif text-lg font-medium">Planned</h3>
      {view.scheduled.length ? (
        rows(view.scheduled)
      ) : (
        <p className="py-3 text-ink-2">Nothing has a time yet.</p>
      )}
      <h3 className="mt-10 font-serif text-lg font-medium">{INBOX}</h3>
      <p className="mt-1 border-b border-rule pb-2.5 text-[13px] text-ink-2">
        Captured and safe, with no day yet. Plan these when you are ready. <SameInInbox />
      </p>
      {view.waiting.length ? (
        rows(view.waiting)
      ) : (
        <p className="py-3 text-ink-2">{EMPTY_TRAY}</p>
      )}
      {waitingFull && <p className="mt-3 text-[13px] text-ink-3">{TRAY_FULL}</p>}
    </section>
  );
}
