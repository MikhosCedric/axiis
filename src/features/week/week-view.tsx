"use client";

import { quickItem, type QuickItem } from "@/features/actions/model";
import { useQuick, type RowHooks } from "@/features/actions/provider";
import { RowActions, rowProps } from "@/features/actions/row-actions";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AreaLabel, AreaMark } from "@/components/area-mark";
import { repeats, type Area, type LocalDate, type ShownItem } from "@/domain/item";
import { RepeatMark } from "@/features/today/repeat-mark";
import { selectedIn, type ItemKey } from "@/domain/item-key";
import { dayHref } from "@/features/day/nav";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { STATE_WORD, weekWords } from "@/features/today/item-name";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { CaptureField } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { formatDayHeading } from "@/features/today/format";
import { formatClock } from "@/lib/clock";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import { DueMark } from "@/features/today/due-mark";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { LineLegend } from "@/features/today/line-legend";
import { SameInInbox } from "@/features/inbox/same-in-inbox";
import { buildToday, EMPTY_TRAY, stateOf, TRAY_FULL, INBOX, type TodayEntry } from "@/features/today/model";
import { dayRangeFor } from "@/lib/dates";
import { moveAction } from "./actions";
import type { WeekData } from "./load";
import {
  bucketWeek,
  formatWeekHeading,
  keyDestination,
  moves,
  moveTo,
  weekdayName,
  weekSummary,
  WEEK_FULL,
  type Destination,
} from "./model";
import { useWeekDrag, type WeekDragPreview } from "./use-week-drag";
import { reach } from "@/lib/reach";
import { FilterChips } from "@/features/filter/filter-chip";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { NO_FILTER, scopeWords, type ViewFilter } from "@/features/filter/model";

/** The writes the week makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type WeekActions = {
  move: (id: string, to: Destination) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
};

const serverActions: WeekActions = { move: moveAction, setDone: setDoneAction, capture: captureAction };

type Patch = { id: ItemKey; changes: Partial<Pick<ShownItem, "schedule" | "status" | "completedAt">> };

const KEYS_ID = "week-keys";
const WEEK_GUIDE: GuideTopic[] = ["capture", "week"];

function useNow(nowIso: string, ticking: boolean) {
  const [now, setNow] = useState(() => new Date(nowIso));
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [ticking]);
  return now;
}

export function WeekView({
  data,
  nav,
  detail,
  filter = NO_FILTER,
  actions = serverActions,
}: {
  data: WeekData;
  nav?: ReactNode;
  detail?: ReactNode;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
  actions?: WeekActions;
}) {
  const clock = useClock();
  const { days, today, timeZone, areas } = data;
  const { selectedParam, selectedId, select } = useItemSelection();
  const quick = useQuick();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<WeekDragPreview | null>(null);
  const fly = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  const now = useNow(data.nowIso, days.includes(today));

  const saved = useMemo(() => [...data.scheduled, ...data.unscheduled], [data.scheduled, data.unscheduled]);
  const [items, patch] = useOptimistic(saved, (current: ShownItem[], p: Patch) =>
    current.map((i) => (i.id === p.id ? { ...i, ...p.changes } : i)),
  );
  const week = useMemo(
    () => bucketWeek(items.filter((i) => i.schedule.kind !== "unscheduled"), days, timeZone, now),
    [items, days, timeZone, now],
  );
  const waiting = useMemo(
    () =>
      buildToday(
        { scheduled: [], unscheduled: items.filter((i) => i.schedule.kind === "unscheduled" && i.parentId === null) },
        dayRangeFor(today, timeZone),
        now,
      ).waiting,
    [items, today, timeZone, now],
  );
  const areaOf = (item: ShownItem) => areas.find((a) => a.id === item.areaId) ?? null;
  const shownSelected = selectedIn(items, selectedId);


  function describe(item: ShownItem, to: Destination) {
    if (to === "tray") return `${item.title} is in the Inbox, with no day.`;
    const s = moveTo(item, to, timeZone).schedule;
    const at = s.kind === "timed" ? ` at ${formatClock(s.start, timeZone, clock)}` : "";
    return `${item.title} is on ${formatDayHeading(to)}${at}.`;
  }

  function move(item: ShownItem, to: Destination) {
    if (!moves(item, to, timeZone)) return;
    setStatus(null);
    startTransition(async () => {
      patch({ id: item.id, changes: moveTo(item, to, timeZone) });
      const result = await reach(actions.move(item.id, to));
      setStatus(result.ok ? { text: describe(item, to), error: false } : { text: result.error, error: true });
    });
  }

  function toggleDone(item: ShownItem) {
    const done = item.status !== "done";
    setStatus(null);
    setJustDone(done ? item.id : null);
    startTransition(async () => {
      patch({ id: item.id, changes: { status: done ? "done" : "open", completedAt: done ? now : null } });
      const result = await reach(actions.setDone(item.id, done));
      const after = stateOf({ ...item, status: done ? "done" : "open" }, now);
      setStatus(result.ok ? { text: `${item.title} is ${STATE_WORD[after]}.`, error: false } : { text: result.error, error: true });
    });
  }

  const start = useWeekDrag(
    fly,
    { days, accepts: (item, to) => moves(item, to, timeZone), onDrop: move, onTap: (item) => select(item.id) },
    setPreview,
  );

  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    const el = document.querySelector<HTMLElement>(`[data-item="${id}"]`);
    if (el && document.activeElement !== el) el.focus();
    if (el) refocus.current = null;
  });

  /** What the quick actions act on for a row or chip. Delete and Backspace keep their meaning here: back to the Inbox. */
  const quickOf = (item: ShownItem): { item: QuickItem; hooks: RowHooks } => ({
    item: { ...quickItem(item, timeZone), title: quick?.patched(item.id)?.title ?? item.title },
    hooks: { onOpen: () => select(item.id), onToggleDone: () => toggleDone(item), deleteKeys: false },
  });

  function keyDown(e: KeyboardEvent<HTMLElement>, item: ShownItem) {
    if (quick) {
      const q = quickOf(item);
      if (quick.keyDown(e, q.item, q.hooks)) return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      select(item.id);
    } else if (e.key === " ") {
      e.preventDefault();
      toggleDone(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      select(null);
    } else {
      const to = keyDestination(item, days, today, timeZone, e.key);
      if (!to) return;
      e.preventDefault();
      refocus.current = item.id;
      move(item, to);
    }
  }

  const row = (entry: TodayEntry, variant: "row" | "chip") => {
    if (quick?.patched(entry.item.id)?.hidden) return null;
    const q = quickOf(entry.item);
    return (
    <>
    <ItemRow
      quick={q}
      entry={entry}
      variant={variant}
      timeZone={timeZone}
      today={today}
      area={areaOf(entry.item)}
      tags={data.tags[entry.item.id]}
      selected={shownSelected === entry.item.id}
      justDone={justDone === entry.item.id}
      lifted={preview?.item.id === entry.item.id}
      onPointerDown={(e) => start(e, entry.item)}
      onKeyDown={(e) => keyDown(e, entry.item)}
    />
    {preview === null && (
      <RowActions
        item={q.item}
        hooks={q.hooks}
        touch={false}
        className={variant === "row" ? "quick-over !top-1 !translate-y-0 [--row-ground:var(--paper)]" : "absolute top-1/2 left-full -translate-y-1/2 border border-rule-soft bg-sheet pl-0.5"}
      />
    )}
    </>
    );
  };

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="@container/page min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <header className="page-head">
          {/* A server element can arrive late as a lazy chunk, which React then checks for a key among its siblings. */}
          <Fragment key="nav">{nav}</Fragment>
          <div className="min-w-0">
            <h1 className="headline">
              {formatWeekHeading(days)}
            </h1>
            <p className="page-summary">{weekSummary(week, waiting, today, scopeWords(filter))}</p>
            <FilterChips filter={filter} className="mt-2.5" />
          </div>
        </header>

        <div className="mt-6 mb-3 flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-[1_1_280px] rail:max-w-[440px]">
            <CaptureField
              captureAction={actions.capture}
              screenStatus={
                <p role="status" className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
                  {status?.text}
                </p>
              }
            />
          </div>
          <GuideButton topics={WEEK_GUIDE} className="ml-auto" />
        </div>

        <section aria-labelledby="week-h" className="@container">
          <h2 id="week-h" className="sr-only">
            Days
          </h2>
          {/* Stacked on a phone, today can be several screens down; the week opens at Monday so its glance line stays in view. */}
          {days.includes(today) && today !== days[0] && (
            <a
              href={`#day-${today}`}
              className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-medium text-ink-2 hover:bg-hover hover:text-ink active:bg-press @min-[50rem]:hidden"
            >
              <svg viewBox="0 0 18 18" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3v11M4.5 9.5L9 14l4.5-4.5" />
              </svg>
              Jump to today, {weekdayName(today, "long")}
            </a>
          )}
          <div className="grid border-y border-rule @min-[50rem]:grid-cols-7">
            {week.map(({ date, entries }) => (
              <DayColumn key={date} date={date} today={today} over={preview?.over === date} empty={entries.length === 0}>
                {entries.map((e) => (
                  <li key={e.item.id} className="group/row relative">
                    {row(e, "row")}
                  </li>
                ))}
              </DayColumn>
            ))}
          </div>
          {data.weekFull && <p className="mt-2 text-[13px] text-ink-3">{WEEK_FULL}</p>}
        </section>

        {/* Every item's description. Seen in the Guide; here only for screen readers. */}
        <p id={KEYS_ID} className="sr-only">
          Drag an item to another day, or down to the tray to clear its day. With an item focused, Left and Right move it
          a day, Backspace sends it to the tray, Space marks it done and Enter opens it. On an item in the Inbox, Up gives it a
          day. The bracket keys change the week and T comes back to this one.
        </p>
        <LineLegend now={false} />

        <section
          data-drop="tray"
          aria-labelledby="week-tray-h"
          className={`mt-7 rounded-lg px-3 pt-2 pb-3 -mx-3 transition-colors ${
            preview?.over === "tray" ? "bg-accent-wash outline-2 outline-dashed outline-accent" : ""
          }`}
        >
          <h2 id="week-tray-h" className="font-serif text-lg leading-tight font-medium">
            {INBOX}
          </h2>
          <p className="mt-1 mb-3.5 text-[13px] text-ink-3">
            No day yet. Drag one onto a day to plan it for that day. Drag a planned item back here to clear its day.{" "}
            <SameInInbox />
          </p>
          {waiting.length ? (
            <ul className="flex flex-wrap gap-2.5">
              {waiting.map((e) => (
                <li key={e.item.id} className="group/row relative min-w-0">
                  {row(e, "chip")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">{EMPTY_TRAY}</p>
          )}
          {data.waitingFull && <p className="mt-3 text-[13px] text-ink-3">{TRAY_FULL}</p>}
        </section>

        <div
          ref={fly}
          hidden={!preview}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-[28ch] items-center gap-2 rounded-md border border-rule bg-sheet px-2.5 py-1.5 shadow-lift"
        >
          {preview && (
            <>
              <Glyph type={preview.item.type} state="planned" className="!w-9" />
              <span className="truncate font-medium">{preview.item.title}</span>
            </>
          )}
        </div>
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

function DayColumn({
  date,
  today,
  over,
  empty,
  children,
}: {
  date: LocalDate;
  today: LocalDate;
  over: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  const isToday = date === today;
  const keep = useKeepFilter();
  // Days already gone are set a step quieter, so the eye finds today and what is still ahead.
  const past = date < today;
  const headingId = `day-${date}`;
  return (
    <section
      data-drop={date}
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col border-b border-rule transition-colors last:border-b-0 @min-[50rem]:min-h-64 @min-[50rem]:border-b-0 @min-[50rem]:border-l @min-[50rem]:first:border-l-0 ${
        over ? "bg-accent-wash" : ""
      }`}
    >
      <h3 id={headingId} className="px-2 pt-3 pb-2">
        <Link
          href={keep(dayHref(date, today, "score"))}
          title={`Open ${formatDayHeading(date)}`}
          className="group inline-flex items-baseline gap-1.5 rounded tap-y"
        >
          <span className={`text-[13px] font-medium ${past ? "text-ink-3" : "text-ink-2"}`}>
            <span className="@min-[50rem]:hidden">{weekdayName(date, "long")}</span>
            <span className="hidden @min-[50rem]:inline">{weekdayName(date, "short")}</span>
          </span>
          <span
            className={`font-serif text-xl leading-none font-medium tabular group-hover:underline ${
              isToday ? "rounded bg-ink px-1.5 py-0.5 text-paper" : past ? "text-ink-3" : ""
            }`}
          >
            {Number(date.slice(8))}
          </span>
          {isToday && <span className="text-[13px] font-medium text-ink-2">Today</span>}
          <span className="sr-only">, {formatDayHeading(date)}</span>
        </Link>
      </h3>
      {empty ? (
        <p className="px-2 pb-3 text-[13px] text-ink-3">Nothing planned</p>
      ) : (
        <ul className="grid gap-0.5 px-1 pb-3">{children}</ul>
      )}
    </section>
  );
}

const TITLE_WEIGHT = { planned: "font-medium text-ink", live: "font-bold text-ink", done: "font-normal text-ink-3" };

function ItemRow({
  quick,
  entry,
  variant,
  timeZone,
  today,
  area,
  tags,
  selected,
  justDone,
  lifted,
  onPointerDown,
  onKeyDown,
}: {
  entry: TodayEntry;
  variant: "row" | "chip";
  timeZone: string;
  today: LocalDate;
  area: Area | null;
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  lifted: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  quick: { item: QuickItem; hooks: RowHooks };
}) {
  const clock = useClock();
  const actions = useQuick();
  const { state } = entry;
  const item = { ...entry.item, title: quick.item.title };
  const dueOn = state !== "done" ? (item.dueOn ?? null) : null;
  const words = weekWords({
    variant,
    title: item.title,
    state,
    repeats: repeats(item),
    dueOn,
    today,
    tags: tags ?? [],
    event: item.type === "event",
    schedule: item.schedule,
    timeZone,
    clock,
    area: area?.name ?? null,
  });
  const shape =
    variant === "chip"
      ? "inline-flex max-w-[34ch] items-center gap-2 rounded-md border border-rule bg-sheet px-2.5 py-1.5 pointer-coarse:min-h-11"
      : "grid grid-cols-[36px_minmax(0,1fr)] gap-x-2 rounded-md px-1.5 py-1.5";
  return (
    <div
      data-item={item.id}
      {...rowProps(actions, quick.item, quick.hooks)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={words.name}
      aria-describedby={KEYS_ID}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`${shape} cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] hover:bg-hover active:bg-press ${
        selected ? "bg-accent-wash ring-1 ring-accent" : ""
      } ${lifted ? "opacity-35" : ""}`}
    >
      <Glyph type={item.type} state={state} justDone={justDone} className={variant === "row" ? "!w-9 mt-0.5" : "!w-9"} />
      {variant === "chip" && <AreaMark color={area?.color ?? null} done={state === "done"} />}
      <span className={`min-w-0 ${variant === "chip" ? "truncate" : ""}`}>
        <span className={`block leading-snug break-words ${variant === "chip" ? "truncate" : ""} ${TITLE_WEIGHT[state]}`}>
          {item.title}
          {repeats(item) && <RepeatMark className="ml-1 text-ink-3" />}
        </span>{" "}
        {variant === "row" && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-3">
            {words.time && <span className="tabular">{words.time}</span>}{" "}
            {dueOn && <DueMark dueOn={dueOn} today={today} />}{" "}
            {area && <AreaLabel name={area.name} color={area.color} />}{" "}
            {words.tags && <span className="min-w-0 truncate">{words.tags}</span>}
          </span>
        )}
      </span>
    </div>
  );
}
