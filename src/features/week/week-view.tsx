"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
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
import { repeats, type LocalDate, type ShownItem } from "@/domain/item";
import { RepeatMark } from "@/features/today/repeat-mark";
import { tagLine } from "@/features/tags/model";
import { selectedIn, type ItemKey } from "@/domain/item-key";
import { dayHref } from "@/features/day/nav";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { HelpHint } from "@/components/help-hint";
import { DetailAside } from "@/features/detail/detail-aside";
import { STATE_WORD } from "@/features/score/score-view";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { CaptureField } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { formatClock, formatDayHeading } from "@/features/today/format";
import { Glyph } from "@/features/today/glyph";
import { LineLegend } from "@/features/today/line-legend";
import { SameInInbox } from "@/features/inbox/same-in-inbox";
import { buildToday, EMPTY_TRAY, stateOf, WAITING, type TodayEntry } from "@/features/today/model";
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
  type Destination,
} from "./model";
import { useWeekDrag, type WeekDragPreview } from "./use-week-drag";

/** The writes the week makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type WeekActions = {
  move: (id: string, to: Destination) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
};

const serverActions: WeekActions = { move: moveAction, setDone: setDoneAction, capture: captureAction };

type Patch = { id: ItemKey; changes: Partial<Pick<ShownItem, "schedule" | "status" | "completedAt">> };

const KEYS_ID = "week-keys";

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
  actions = serverActions,
}: {
  data: WeekData;
  nav?: ReactNode;
  detail?: ReactNode;
  actions?: WeekActions;
}) {
  const { days, today, timeZone, areas } = data;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
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
  const areaName = (item: ShownItem) => areas.find((a) => a.id === item.areaId)?.name ?? null;
  const shownSelected = selectedIn(items, selectedId);

  function select(id: string | null) {
    startTransition(() => {
      setSelectedId(id);
      const next = new URLSearchParams(params.toString());
      if (id === null) next.delete(SELECTED_ITEM_PARAM);
      else next.set(SELECTED_ITEM_PARAM, id);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function describe(item: ShownItem, to: Destination) {
    if (to === "tray") return `${item.title} is waiting, with no day.`;
    const s = moveTo(item, to, timeZone).schedule;
    const at = s.kind === "timed" ? ` at ${formatClock(s.start, timeZone)}` : "";
    return `${item.title} is on ${formatDayHeading(to)}${at}.`;
  }

  function move(item: ShownItem, to: Destination) {
    if (!moves(item, to, timeZone)) return;
    setStatus(null);
    startTransition(async () => {
      patch({ id: item.id, changes: moveTo(item, to, timeZone) });
      const result = await actions.move(item.id, to);
      setStatus(result.ok ? { text: describe(item, to), error: false } : { text: result.error, error: true });
    });
  }

  function toggleDone(item: ShownItem) {
    const done = item.status !== "done";
    setStatus(null);
    setJustDone(done ? item.id : null);
    startTransition(async () => {
      patch({ id: item.id, changes: { status: done ? "done" : "open", completedAt: done ? now : null } });
      const result = await actions.setDone(item.id, done);
      const after = stateOf({ ...item, status: done ? "done" : "open" }, now);
      setStatus(result.ok ? { text: `${item.title} is ${STATE_WORD[after]}.`, error: false } : { text: result.error, error: true });
    });
  }

  const start = useWeekDrag(fly, { days, timeZone, onDrop: move, onTap: (item) => select(item.id) }, setPreview);

  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    const el = document.querySelector<HTMLElement>(`[data-item="${id}"]`);
    if (el && document.activeElement !== el) el.focus();
    if (el) refocus.current = null;
  });

  function keyDown(e: KeyboardEvent<HTMLElement>, item: ShownItem) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      select(item.id);
    } else if (e.key === " ") {
      e.preventDefault();
      toggleDone(item);
    } else if (e.key === "Escape") {
      select(null);
    } else {
      const to = keyDestination(item, days, today, timeZone, e.key);
      if (!to) return;
      e.preventDefault();
      refocus.current = item.id;
      move(item, to);
    }
  }

  const row = (entry: TodayEntry, variant: "row" | "chip") => (
    <ItemRow
      entry={entry}
      variant={variant}
      timeZone={timeZone}
      area={areaName(entry.item)}
      tags={data.tags[entry.item.id]}
      selected={shownSelected === entry.item.id}
      justDone={justDone === entry.item.id}
      lifted={preview?.item.id === entry.item.id}
      onPointerDown={(e) => start(e, entry.item)}
      onKeyDown={(e) => keyDown(e, entry.item)}
    />
  );

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <header className="flex flex-col gap-3 rail:flex-row-reverse rail:items-start rail:justify-between rail:gap-6">
          {nav}
          <div className="min-w-0">
            <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em] text-balance">
              {formatWeekHeading(days)}
            </h1>
            <p className="mt-2.5 text-[15px] text-ink-2">{weekSummary(week, waiting)}</p>
          </div>
        </header>

        <div className="mt-6 max-w-[440px]">
          <CaptureField captureAction={actions.capture} />
        </div>

        <p role="status" className={`mb-2 min-h-5 text-[13px] ${status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {status?.text}
        </p>

        <section aria-labelledby="week-h" className="@container">
          <h2 id="week-h" className="sr-only">
            Days
          </h2>
          <div className="grid border-y border-rule @min-[50rem]:grid-cols-7">
            {week.map(({ date, entries }) => (
              <DayColumn key={date} date={date} today={today} over={preview?.over === date} empty={entries.length === 0}>
                {entries.map((e) => (
                  <li key={e.item.id}>{row(e, "row")}</li>
                ))}
              </DayColumn>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-6">
          <HelpHint id={KEYS_ID} label="Keyboard help">
            Drag an item to another day, or down to the tray to clear its day. With an item focused, <Kbd>←</Kbd>{" "}
            <Kbd>→</Kbd> move it a day, <Kbd>Backspace</Kbd> sends it to the tray, <Kbd>Space</Kbd> marks it done and{" "}
            <Kbd>Enter</Kbd> opens it. On a waiting item, <Kbd>↑</Kbd> gives it a day. <Kbd>[</Kbd> <Kbd>]</Kbd> change
            the week and <Kbd>T</Kbd> comes back to this one.
          </HelpHint>
          <LineLegend now={false} />
        </div>

        <section
          data-drop="tray"
          aria-labelledby="week-tray-h"
          className={`mt-7 rounded-lg px-3 pt-2 pb-3 -mx-3 transition-colors ${
            preview?.over === "tray" ? "bg-accent-wash outline-2 outline-dashed outline-accent" : ""
          }`}
        >
          <h2 id="week-tray-h" className="font-serif text-lg leading-tight font-medium">
            {WAITING}
          </h2>
          <p className="mt-1 mb-3.5 text-[13px] text-ink-3">
            No day yet. Drag one onto a day to plan it for that day. Drag a planned item back here to clear its day.{" "}
            <SameInInbox />
          </p>
          {waiting.length ? (
            <ul className="flex flex-wrap gap-2.5">
              {waiting.map((e) => (
                <li key={e.item.id} className="min-w-0">
                  {row(e, "chip")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">{EMPTY_TRAY}</p>
          )}
        </section>

        <div
          ref={fly}
          hidden={!preview}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-[28ch] items-center gap-2 rounded-md border border-rule bg-sheet px-2.5 py-1.5 shadow-[0_6px_18px_rgba(28,27,34,0.18)]"
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

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-rule px-1 font-sans text-xs font-semibold text-ink-2">{children}</kbd>;
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
          href={dayHref(date, today, "score")}
          title={`Open ${formatDayHeading(date)}`}
          className="group inline-flex items-baseline gap-1.5 rounded"
        >
          <span className="text-[13px] font-medium text-ink-2">
            <span className="@min-[50rem]:hidden">{weekdayName(date, "long")}</span>
            <span className="hidden @min-[50rem]:inline">{weekdayName(date, "short")}</span>
          </span>
          <span
            className={`font-serif text-xl leading-none font-medium tabular group-hover:underline ${
              isToday ? "rounded bg-accent px-1.5 py-0.5 text-on-accent" : ""
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
  entry,
  variant,
  timeZone,
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
  area: string | null;
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  lifted: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const { item, state } = entry;
  const s = item.schedule;
  const time = s.kind === "timed" ? formatClock(s.start, timeZone) : s.kind === "day" ? "Any time" : null;
  const spokenTime =
    s.kind === "timed" ? `${formatClock(s.start, timeZone)} to ${formatClock(s.end, timeZone)}` : (time ?? "waiting");
  const tagged = tagLine(tags ?? [], 2);
  const label = [item.title, spokenTime, area, STATE_WORD[state], repeats(item) && "repeats", tagged.spoken].filter(Boolean).join(", ");
  const shape =
    variant === "chip"
      ? "inline-flex max-w-[34ch] items-center gap-2 rounded-md border border-rule bg-sheet px-2.5 py-1.5"
      : "grid grid-cols-[36px_minmax(0,1fr)] gap-x-2 rounded-md px-1.5 py-1.5";
  return (
    <div
      data-item={item.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      aria-describedby={KEYS_ID}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`${shape} cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] hover:bg-accent-wash ${
        selected ? "bg-accent-wash ring-1 ring-accent" : ""
      } ${lifted ? "opacity-35" : ""}`}
    >
      <Glyph type={item.type} state={state} justDone={justDone} className={variant === "row" ? "!w-9 mt-0.5" : "!w-9"} />
      <span className={`min-w-0 ${variant === "chip" ? "truncate" : ""}`}>
        <span className={`block leading-snug break-words ${variant === "chip" ? "truncate" : ""} ${TITLE_WEIGHT[state]}`}>
          {item.title}
          {repeats(item) && <RepeatMark className="ml-1 text-ink-3" />}
        </span>
        {variant === "row" && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-3">
            {time && <span className="tabular">{time}</span>}
            {area && <span className="min-w-0 truncate">{area}</span>}
            {tagged.shown && <span className="min-w-0 truncate">{tagged.shown}</span>}
          </span>
        )}
      </span>
    </div>
  );
}
