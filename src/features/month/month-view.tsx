"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AreaLabel, AreaMark } from "@/components/area-mark";
import type { LocalDate } from "@/domain/item";
import { dayHref } from "@/features/day/nav";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { CaptureField } from "@/features/today/capture-field";
import { formatDayHeading } from "@/features/today/format";
import { Glyph } from "@/features/today/glyph";
import { monthMarkName } from "@/features/today/item-name";
import type { BeamState } from "@/features/today/model";
import { RepeatMark } from "@/features/today/repeat-mark";
import { moveAction } from "@/features/week/actions";
import { weekdayName, type Destination } from "@/features/week/model";
import { useWeekDrag, type WeekDragPreview } from "@/features/week/use-week-drag";
import { addDays } from "@/lib/dates";
import { captureOnAction } from "./actions";
import type { MonthData } from "./load";
import { reach } from "@/lib/reach";
import { FilterChips } from "@/features/filter/filter-chip";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { NO_FILTER, type ViewFilter } from "@/features/filter/model";
import {
  anchorOf,
  countWords,
  dayTotal,
  formatMonthHeading,
  gridStep,
  MARKS_PER_DAY,
  monthHref,
  monthOf,
  parseYearMonth,
  MONTH_FULL,
  sameDayIn,
  selectedMarkKey,
  type MonthCell,
  type MonthMark,
} from "./model";

const KEYS_ID = "month-keys";
const MONTH_GUIDE: GuideTopic[] = ["capture", "month"];
/** Narrower than this, the grid draws dots and the chosen day's items are listed under it. Matches the `@min-[36rem]/month` rules. */
const COMPACT_PX = 576;

const ARRIVAL_KEY = "axiis-month-focus";

/** The day to focus when a month arrives because the arrow keys walked off the edge of the last one. Read once. */
function takeArrival(days: readonly LocalDate[]): LocalDate | null {
  try {
    const day = sessionStorage.getItem(ARRIVAL_KEY) as LocalDate | null;
    if (!day || !days.includes(day)) return null;
    sessionStorage.removeItem(ARRIVAL_KEY);
    return day;
  } catch {
    return null;
  }
}

function leaveArrival(day: LocalDate) {
  try {
    sessionStorage.setItem(ARRIVAL_KEY, day);
  } catch {}
}

type Move = { key: string; from: LocalDate; to: LocalDate };

function moveMark(cells: MonthCell[], { key, from, to }: Move): MonthCell[] {
  const mark = cells.find((c) => c.date === from)?.marks.find((m) => m.key === key);
  if (!mark) return cells;
  return cells.map((c) => {
    if (c.date === from) return { ...c, marks: c.marks.filter((m) => m.key !== key) };
    if (c.date !== to) return c;
    return c.marks.length < MARKS_PER_DAY ? { ...c, marks: [...c.marks, { ...mark, due: false }] } : { ...c, more: c.more + 1 };
  });
}

function cellLabel(cell: MonthCell): string {
  return `${formatDayHeading(cell.date)}, ${countWords(dayTotal(cell)).toLowerCase()}`;
}

export function MonthView({
  data,
  nav,
  detail,
  filter = NO_FILTER,
}: {
  data: MonthData;
  nav?: ReactNode;
  detail?: ReactNode;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
}) {
  const { month, today } = data;
  const router = useRouter();
  const keep = useKeepFilter();
  const { selectedParam, selectedId: selected, select } = useItemSelection();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [preview, setPreview] = useState<WeekDragPreview<MonthMark & { from: LocalDate }> | null>(null);
  const [cells, move] = useOptimistic(data.cells, moveMark);
  const days = cells.map((c) => c.date);
  const shownSelected = selectedMarkKey(cells, selected);
  const [active, setActive] = useState<LocalDate>(() => anchorOf(month, today));
  const [shownMonth, setShownMonth] = useState(month);
  if (shownMonth !== month) {
    setShownMonth(month);
    setActive(anchorOf(month, today));
  }
  const grid = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  const focusActive = useRef(false);
  /** Whether the day under a press was already the chosen one, read before the press focuses it. */
  const pressedChosen = useRef(false);

  useEffect(() => {
    // Focusing the cell makes it the chosen day through its own focus handler.
    const arrived = takeArrival(days);
    if (!arrived && !focusActive.current) return;
    focusActive.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${arrived ?? active}"]`)?.focus();
  });

  function drop(mark: MonthMark & { from: LocalDate }, to: Destination) {
    if (to === "tray" || to === mark.from) return;
    setStatus(null);
    startTransition(async () => {
      move({ key: mark.key, from: mark.from, to });
      const result = await reach(moveAction(mark.key, to));
      setStatus(result.ok ? { text: `${mark.title} is on ${formatDayHeading(to)}.`, error: false } : { text: result.error, error: true });
    });
  }

  const start = useWeekDrag(
    fly,
    { days, accepts: (mark, to) => to !== "tray" && to !== mark.from, onDrop: drop, onTap: (mark) => select(mark.key) },
    setPreview,
  );

  const openDay = (date: LocalDate) => router.push(keep(dayHref(date, today, "score")));

  function moveFocus(to: LocalDate) {
    if (days.includes(to)) {
      focusActive.current = true;
      setActive(to);
      return;
    }
    if (!parseYearMonth(monthOf(to))) return;
    leaveArrival(to);
    router.push(keep(monthHref(monthOf(to), today)));
  }

  function cellKeyDown(e: KeyboardEvent<HTMLElement>, date: LocalDate, index: number) {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      openDay(date);
      return;
    }
    if (e.key === "Escape" && selectedParam) {
      e.preventDefault();
      select(null);
      return;
    }
    const step = gridStep(e.key, index);
    if (!step) return;
    e.preventDefault();
    moveFocus("days" in step ? addDays(date, step.days) : sameDayIn(date, step.months));
  }

  /** On a phone the first tap chooses the day and lists it below; a tap on the chosen day opens it. */
  function cellClick(date: LocalDate) {
    const compact = (grid.current?.clientWidth ?? COMPACT_PX) < COMPACT_PX;
    if (compact && !pressedChosen.current) setActive(date);
    else openDay(date);
  }

  function markKeyDown(e: KeyboardEvent<HTMLElement>, mark: MonthMark) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      select(mark.key);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      select(null);
    }
  }

  const mark = (m: MonthMark, date: LocalDate, focusable: boolean, variant: "cell" | "row") => (
    <MarkButton
      key={`${m.key}-${m.due}`}
      mark={m}
      variant={variant}
      focusable={focusable}
      selected={shownSelected === m.key}
      lifted={preview?.item.key === m.key}
      onPointerDown={m.movable ? (e) => start(e, { ...m, from: date }) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!m.movable) select(m.key);
      }}
      onKeyDown={(e) => markKeyDown(e, m)}
    />
  );

  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const activeCell = cells.find((c) => c.date === active) ?? cells[0];

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="@container/page min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <header className="page-head">
          <Fragment key="nav">{nav}</Fragment>
          <div className="min-w-0">
            <h1 id="month-h" className="headline">
              {formatMonthHeading(month)}
            </h1>
            <p className="page-summary">{data.summary}</p>
            <FilterChips filter={filter} className="mt-2.5" />
          </div>
        </header>

        <div className="mt-6 mb-3 flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-[1_1_280px] rail:max-w-[440px]">
            <CaptureField
              captureAction={(title) => captureOnAction(title, active)}
              label={`Capture for ${formatDayHeading(active)}`}
              placeholder={`Capture for ${formatDayHeading(active)}`}
              screenStatus={
                <p role="status" className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
                  {status?.text}
                </p>
              }
            />
          </div>
          <GuideButton topics={MONTH_GUIDE} className="ml-auto" />
        </div>

        <section aria-label="Days of the month" className="@container/month">
          <div
            ref={grid}
            role="grid"
            aria-labelledby="month-h"
            aria-describedby={KEYS_ID}
            className="border-t border-l border-rule"
          >
            <div role="row" className="grid grid-cols-7">
              {weeks[0].map((c) => (
                <div
                  key={c.date}
                  role="columnheader"
                  aria-label={weekdayName(c.date, "long")}
                  className="border-r border-b border-rule px-1 py-1.5 text-center text-xs font-medium text-ink-2 @min-[36rem]/month:px-2 @min-[36rem]/month:text-left"
                >
                  <span aria-hidden="true">
                    <span className="@min-[36rem]/month:hidden">{weekdayName(c.date, "short").slice(0, 2)}</span>
                    <span className="hidden @min-[36rem]/month:inline">{weekdayName(c.date, "short")}</span>
                  </span>
                </div>
              ))}
            </div>
            {weeks.map((week, w) => (
              <div key={week[0].date} role="row" className="grid grid-cols-7">
                {week.map((cell, i) => (
                  <DayCell
                    key={cell.date}
                    cell={cell}
                    inMonth={monthOf(cell.date) === month}
                    isToday={cell.date === today}
                    active={cell.date === active}
                    over={preview?.over === cell.date}
                    href={keep(dayHref(cell.date, today, "score"))}
                    onFocus={() => setActive(cell.date)}
                    onPointerDown={() => (pressedChosen.current = cell.date === active)}
                    onClick={() => cellClick(cell.date)}
                    onKeyDown={(e) => cellKeyDown(e, cell.date, w * 7 + i)}
                  >
                    {cell.marks.map((m) => (
                      <li key={`${m.key}-${m.due}`} className="min-w-0">
                        {mark(m, cell.date, cell.date === active, "cell")}
                      </li>
                    ))}
                  </DayCell>
                ))}
              </div>
            ))}
          </div>
          {data.full && <p className="mt-2 text-[13px] text-ink-3">{MONTH_FULL}</p>}

          <section aria-labelledby="month-day-h" className="mt-5 @min-[36rem]/month:hidden">
            <h2 id="month-day-h" className="font-serif text-lg leading-tight font-medium">
              {formatDayHeading(activeCell.date)}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-3">{countWords(dayTotal(activeCell))}</p>
            {activeCell.marks.length > 0 && (
              <ul className="mt-2 grid gap-0.5">
                {activeCell.marks.map((m) => (
                  <li key={`${m.key}-${m.due}`}>{mark(m, activeCell.date, false, "row")}</li>
                ))}
              </ul>
            )}
            <Link
              href={keep(dayHref(activeCell.date, today, "score"))}
              className="mt-2 inline-flex min-h-11 items-center rounded-md font-medium text-ink underline underline-offset-2 hover:bg-hover"
            >
              {activeCell.more > 0 ? `${activeCell.more} more. Open the day` : "Open the day"}
            </Link>
          </section>
        </section>

        <p id={KEYS_ID} className="sr-only">
          Arrow keys move between days, Home and End go to the ends of the week, Page Up and Page Down change the month,
          and Enter opens the day. Tab reaches the focused day&apos;s items; Enter opens one. Drag an item to another day
          to move it. The bracket keys change the month and T comes back to this one.
        </p>

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

      {selectedParam && <DetailAside pending={selected !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

function DayCell({
  cell,
  inMonth,
  isToday,
  active,
  over,
  href,
  onFocus,
  onPointerDown,
  onClick,
  onKeyDown,
  children,
}: {
  cell: MonthCell;
  inMonth: boolean;
  isToday: boolean;
  active: boolean;
  over: boolean;
  href: string;
  onFocus: () => void;
  onPointerDown: () => void;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const number = Number(cell.date.slice(8));
  return (
    <div
      role="gridcell"
      data-date={cell.date}
      data-drop={cell.date}
      tabIndex={active ? 0 : -1}
      aria-selected={active}
      aria-current={isToday ? "date" : undefined}
      onFocus={(e) => e.target === e.currentTarget && onFocus()}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`group/day relative flex min-h-14 min-w-0 cursor-pointer flex-col border-r border-b border-rule px-0.5 pt-1 pb-1 transition-colors focus-visible:outline-offset-[-3px] @min-[36rem]/month:min-h-32 @min-[36rem]/month:px-1 ${
        over ? "bg-accent-wash" : active ? "bg-hover @min-[36rem]/month:bg-transparent" : "hover:bg-hover"
      }`}
    >
      {/* The cell is named by its content, not aria-label: its marks are drawn inside it, and a name must hold what it draws. */}
      <span className="sr-only">{cellLabel(cell)}</span>
      <span aria-hidden="true" className="flex items-center justify-center @min-[36rem]/month:justify-start">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular ${
            isToday ? "bg-ink font-semibold text-paper" : inMonth ? "font-medium text-ink" : "text-ink-3"
          }`}
        >
          {number}
        </span>
        {number === 1 && <span className="ml-1 hidden text-xs text-ink-3 @min-[36rem]/month:inline">{formatDayHeading(cell.date).split(" ").at(-1)?.slice(0, 3)}</span>}
      </span>

      {cell.marks.length > 0 && (
        <span aria-hidden="true" className="mt-1 flex items-center justify-center gap-[3px] @min-[36rem]/month:hidden">
          {cell.marks.map((m) => (
            <Dot key={`${m.key}-${m.due}`} state={m.state} />
          ))}
          {cell.more > 0 && <span className="text-[11px] leading-none text-ink-3 tabular">+{cell.more}</span>}
        </span>
      )}

      <ul className="mt-1 hidden min-w-0 gap-px @min-[36rem]/month:grid">
        {children}
      </ul>
      {cell.more > 0 && (
        <Link
          href={href}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="mt-auto hidden self-start rounded px-1 text-xs font-medium text-ink-2 hover:bg-hover hover:text-ink @min-[36rem]/month:inline"
        >
          +{cell.more} more
        </Link>
      )}
    </div>
  );
}

/** A day's mark on a phone: filled while planned, hollow once done, never colour alone. */
function Dot({ state }: { state: BeamState }) {
  const look = state === "done" ? "border border-ink-3" : state === "live" ? "bg-accent" : "bg-ink";
  return <span className={`block size-1.5 rounded-full ${look}`} />;
}

const TITLE = { planned: "font-medium text-ink", live: "font-bold text-ink", done: "font-normal text-ink-3" };

function MarkButton({
  mark,
  variant,
  focusable,
  selected,
  lifted,
  onPointerDown,
  onClick,
  onKeyDown,
}: {
  mark: MonthMark;
  variant: "cell" | "row";
  focusable: boolean;
  selected: boolean;
  lifted: boolean;
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const label = monthMarkName(mark, variant);
  const shape =
    variant === "cell"
      ? "flex h-[22px] items-center gap-1 rounded px-0.5 text-xs"
      : "flex min-h-11 items-center gap-2 rounded-md px-1.5 text-sm";
  return (
    <div
      data-item={mark.key}
      role="button"
      tabIndex={variant === "row" || focusable ? 0 : -1}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`${shape} min-w-0 select-none [-webkit-touch-callout:none] hover:bg-hover active:bg-press ${
        mark.movable ? "cursor-grab touch-manipulation" : "cursor-pointer"
      } ${selected ? "bg-accent-wash ring-1 ring-accent" : ""} ${lifted ? "opacity-35" : ""}`}
    >
      {variant === "cell" && <AreaMark color={mark.areaColor} done={mark.state === "done"} size={6} />}
      <span aria-hidden="true" className={variant === "cell" ? "w-[22px] flex-none overflow-hidden" : "w-9 flex-none"}>
        <Glyph type={mark.type} state={mark.state} className={variant === "cell" ? "!w-[30px] origin-left scale-[0.72]" : "!w-9"} />
      </span>
      {mark.time && <span className="flex-none text-ink-3 tabular">{mark.time}</span>}{" "}
      {mark.due && <span className="flex-none text-ink-3">{mark.time ? "· due" : "Due"}</span>}{" "}
      <span className={`min-w-0 truncate ${TITLE[mark.state]}`}>{mark.title}</span>
      {mark.repeats && <RepeatMark className="text-ink-3" />}{" "}
      {variant === "row" && mark.area && (
        <AreaLabel name={mark.area} color={mark.areaColor} className="ml-auto flex-none text-xs text-ink-3" />
      )}
    </div>
  );
}
