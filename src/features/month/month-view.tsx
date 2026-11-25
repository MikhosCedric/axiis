"use client";

import { quickMark } from "@/features/actions/quick-item";
import { useQuick } from "@/features/actions/context";
import { RowActions, rowProps } from "@/features/actions/row-actions";
import { gridStep } from "./grid-step";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AreaLabel, AreaMark } from "@/components/area-mark";
import type { LocalDate } from "@/domain/item";
import { LeftoverBar } from "@/features/day/leftover-bar";
import type { LeftoverData } from "@/features/day/leftover-model";
import { dayHref } from "@/features/day/nav";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { PageHeader } from "@/components/shell/page-header";
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
  cellRoom,
  countWords,
  dayTotal,
  fitMarks,
  formatMonthHeading,
  MARKS_PER_DAY,
  monthHref,
  monthOf,
  parseYearMonth,
  MONTH_FULL,
  sameDayIn,
  selectedMarkKey,
  type CellRoom,
  type MonthCell,
  type MonthMark,
} from "./model";

const KEYS_ID = "month-keys";
const MONTH_GUIDE: GuideTopic[] = ["capture", "month"];
/** Narrower than this, the grid draws dots and the chosen day's items are listed under it. Matches the `@min-[36rem]/month` rules. */
const COMPACT_PX = 576;

const ARRIVAL_KEY = "axiis-month-focus";

/** A cell mark is 22px tall with 1px between marks; "+N more" takes this much under them; the cell pads 4px below. */
const MARK_PITCH = 23;
const MORE_LINE = 16;
const CELL_PAD = 4;
/** The least a week row gets when the grid fills the window, so a short window scrolls rather than crushing the days. */
const ROW_MIN_PX = 88;

/**
 * On a desktop window the grid fills the height under the head, its weeks share it, and each cell draws as many marks
 * as it has room for. Measured, since the head's height and the window's are not known to CSS. Null on a phone and
 * before the page wakes: the cells keep their own height and draw three marks.
 */
function useMonthFit(grid: RefObject<HTMLDivElement | null>, weeks: number): { height: number; room: CellRoom } | null {
  const [fit, setFit] = useState<{ height: number; room: CellRoom } | null>(null);

  useLayoutEffect(() => {
    const el = grid.current;
    const page = el?.closest<HTMLElement>("[data-month-page]");
    if (!el || !page) return;
    const wide = window.matchMedia("(min-width: 760px)");
    const measure = () => {
      const cell = el.querySelector<HTMLElement>("[role=gridcell]");
      const list = cell?.querySelector("ul");
      // A phone, or a grid narrow enough to draw dots: the cells keep their own height.
      if (!wide.matches || el.clientWidth < COMPACT_PX || !cell || !list || list.offsetParent === null) {
        setFit(null);
        return;
      }
      const box = el.getBoundingClientRect();
      // What sits under the grid on the page (the bottom padding, a note) keeps its place under it.
      const under = page.getBoundingClientRect().bottom - box.bottom;
      const head = el.querySelector<HTMLElement>("[role=row]")?.offsetHeight ?? 0;
      const height = Math.max(head + weeks * ROW_MIN_PX, Math.floor(window.innerHeight - (box.top + window.scrollY) - under));
      // The weeks share what is left under the weekday heads (less the grid's own border); the marks start a fixed
      // way down each cell, under its number, whatever the cell's height.
      const row = (height - (el.offsetHeight - el.clientHeight) - head) / weeks;
      const room = cellRoom(row - (list.getBoundingClientRect().top - cell.getBoundingClientRect().top) - CELL_PAD, MARK_PITCH, MORE_LINE);
      setFit((was) =>
        was?.height === height && was.room.all === room.all && was.room.withMore === room.withMore ? was : { height, room },
      );
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(page);
    wide.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      watch.disconnect();
      wide.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [grid, weeks]);

  return fit;
}

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
  leftover = null,
  filter = NO_FILTER,
}: {
  data: MonthData;
  /** Open items from earlier days, as one line above the grid. */
  leftover?: LeftoverData | null;
  nav?: ReactNode;
  detail?: ReactNode;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
}) {
  const { month, today } = data;
  const router = useRouter();
  const keep = useKeepFilter();
  const { selectedParam, selectedId: selected, select } = useItemSelection();
  const quick = useQuick();
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

  // The grid sits under the Month's loading boundary, which React hydrates after the layout that sets
  // <html data-hydrated>. Until then a key pressed on a day can be dropped, so browser tests wait for this mark.
  useEffect(() => {
    if (grid.current) grid.current.dataset.hydrated = "";
  }, []);

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

  const openDay = (date: LocalDate) => router.push(keep(dayHref(date, today, "grid")));

  /** Makes the day the active one and goes to the capture field, which captures for the active day. */
  function addTo(date: LocalDate) {
    setActive(date);
    document.getElementById("capture")?.focus();
  }

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
    if (e.key === "+") {
      e.preventDefault();
      addTo(date);
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

  const mark = (shown: MonthMark, date: LocalDate, focusable: boolean, variant: "cell" | "row") => {
    const patch = quick?.patched(shown.key);
    if (patch?.hidden) return null;
    const m: MonthMark = {
      ...shown,
      title: patch?.title ?? shown.title,
      state: patch?.done === undefined ? shown.state : patch.done ? "done" : shown.state === "done" ? "planned" : shown.state,
    };
    const qi = quickMark(m, date);
    const hooks = { onOpen: () => select(m.key) };
    return (
    <>
    <MarkButton
      key={`${m.key}-${m.due}`}
      quickProps={rowProps(quick, qi, hooks)}
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
      onKeyDown={(e) => {
        if (quick?.keyDown(e, qi, hooks)) return;
        markKeyDown(e, m);
      }}
    />
    {preview === null && (
      <RowActions item={qi} hooks={hooks} compact
        touch={false}
        className={variant === "row" ? "quick-over" : "absolute top-1/2 left-full -translate-y-1/2 border border-rule-soft bg-sheet pl-0.5"}
      />
    )}
    </>
    );
  };

  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const fit = useMonthFit(grid, weeks.length);
  const room = fit?.room ?? null;
  const fitted = fit !== null;
  const activeCell = cells.find((c) => c.date === active) ?? cells[0];

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div data-month-page="" className="@container/page mx-auto w-full min-w-0 max-w-[1600px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8 rail:pb-4">
        <PageHeader
          bar
          inline
          heading={
            <Fragment key="nav">
              {nav ?? (
                <h1 id="month-h" className="headline">
                  {formatMonthHeading(month)}
                </h1>
              )}
            </Fragment>
          }
          controls={<GuideButton topics={MONTH_GUIDE} />}
          capture={
            <CaptureField
              inline
              captureAction={(title) => captureOnAction(title, active)}
              label={`Capture for ${formatDayHeading(active)}`}
              placeholder={`Capture for ${formatDayHeading(active)}`}
              screenStatus={
                <p role="status" className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
                  {status?.text}
                </p>
              }
            />
          }
        >
          <p className="page-summary">{data.summary}</p>
          <FilterChips filter={filter} className="mt-2.5" />
        </PageHeader>

        <LeftoverBar data={leftover} />

        <section aria-label="Days of the month" className="@container/month">
          <div
            ref={grid}
            role="grid"
            aria-labelledby="month-h"
            aria-describedby={KEYS_ID}
            data-fit={fitted ? "" : undefined}
            style={fit ? { height: fit.height } : undefined}
            className={`surface overflow-hidden [&>[role=row]]:-mr-px [&>[role=row]:last-child]:-mb-px ${fitted ? "flex flex-col" : ""}`}
          >
            <div role="row" className="grid grid-cols-7">
              {weeks[0].map((c) => (
                <div
                  key={c.date}
                  role="columnheader"
                  aria-label={weekdayName(c.date, "long")}
                  className="border-r border-b border-rule-soft bg-[color-mix(in_srgb,var(--paper-2)_55%,var(--sheet))] px-1 py-1.5 text-center text-xs font-medium text-ink-2 @min-[36rem]/month:px-2 @min-[36rem]/month:text-left"
                >
                  <span aria-hidden="true">
                    <span className="@min-[36rem]/month:hidden">{weekdayName(c.date, "short").slice(0, 2)}</span>
                    <span className="hidden @min-[36rem]/month:inline">{weekdayName(c.date, "short")}</span>
                  </span>
                </div>
              ))}
            </div>
            {weeks.map((week, w) => (
              <div key={week[0].date} role="row" className={`grid grid-cols-7 ${fitted ? "min-h-0 flex-1" : ""}`}>
                {week.map((cell, i) => {
                  const { shown, more } = fitMarks(cell, room);
                  return (
                  <DayCell
                    key={cell.date}
                    cell={cell}
                    shown={shown}
                    more={more}
                    fitted={fitted}
                    inMonth={monthOf(cell.date) === month}
                    isToday={cell.date === today}
                    active={cell.date === active}
                    over={preview?.over === cell.date}
                    href={keep(dayHref(cell.date, today, "grid"))}
                    onFocus={() => setActive(cell.date)}
                    onPointerDown={() => (pressedChosen.current = cell.date === active)}
                    onClick={() => cellClick(cell.date)}
                    onAdd={() => addTo(cell.date)}
                    onKeyDown={(e) => cellKeyDown(e, cell.date, w * 7 + i)}
                  >
                    {cell.marks.slice(0, shown).map((m) => (
                      <li key={`${m.key}-${m.due}`} className="group/row relative min-w-0">
                        {mark(m, cell.date, cell.date === active, "cell")}
                      </li>
                    ))}
                  </DayCell>
                  );
                })}
              </div>
            ))}
          </div>
          {data.full && <p className="mt-2 text-[13px] text-ink-3">{MONTH_FULL}</p>}

          <section aria-labelledby="month-day-h" className="mt-5 @min-[36rem]/month:hidden">
            <h2 id="month-day-h" className="font-display text-lg leading-tight font-medium">
              {formatDayHeading(activeCell.date)}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-3">{countWords(dayTotal(activeCell))}</p>
            {activeCell.marks.length > 0 && (
              <ul className="mt-2 grid gap-0.5">
                {activeCell.marks.map((m) => (
                  <li key={`${m.key}-${m.due}`} className="group/row relative">
                    {mark(m, activeCell.date, false, "row")}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4">
              <Link
                href={keep(dayHref(activeCell.date, today, "grid"))}
                className="inline-flex min-h-11 items-center rounded-md font-medium text-ink underline underline-offset-2 hover:bg-hover"
              >
                {activeCell.more > 0 ? `${activeCell.more} more. Open the day` : "Open the day"}
              </Link>
              <button
                type="button"
                onClick={() => addTo(activeCell.date)}
                className="inline-flex min-h-11 items-center rounded-md font-medium text-ink underline underline-offset-2 hover:bg-hover"
              >
                Add to this day
              </button>
            </div>
          </section>
        </section>

        <p id={KEYS_ID} className="sr-only">
          Arrow keys move between days, Home and End go to the ends of the week, Page Up and Page Down change the month,
          Enter opens the day, and the plus key adds to it. Tab reaches the focused day&apos;s items; Enter opens one. Drag an item to another day
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
  shown,
  more,
  fitted,
  inMonth,
  isToday,
  active,
  over,
  href,
  onFocus,
  onPointerDown,
  onClick,
  onAdd,
  onKeyDown,
  children,
}: {
  cell: MonthCell;
  /** How many of the sent marks the cell draws, and what its "+N more" counts. */
  shown: number;
  more: number;
  /** The grid fills the window: the cell takes its row's height rather than its own least height. */
  fitted: boolean;
  inMonth: boolean;
  isToday: boolean;
  active: boolean;
  over: boolean;
  href: string;
  onFocus: () => void;
  onPointerDown: () => void;
  onClick: () => void;
  onAdd: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const number = Number(cell.date.slice(8));
  // A day whose every item is done wears a small tick beside its number: the day is finished, at a glance.
  const allDone = cell.more === 0 && cell.marks.length > 0 && cell.marks.every((m) => m.state === "done");
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
      className={`group/day relative flex min-h-14 min-w-0 cursor-pointer flex-col border-r border-b border-rule-soft px-0.5 pt-1 pb-1 transition-colors focus-visible:outline-offset-[-3px] @min-[36rem]/month:px-1 ${fitted ? "" : "@min-[36rem]/month:min-h-32"} ${
        over ? "bg-accent-wash" : active ? "bg-hover @min-[36rem]/month:bg-transparent" : "hover:bg-hover"
      } ${inMonth ? (isToday ? "bg-[color-mix(in_srgb,var(--ink)_3.5%,transparent)]" : "") : "bg-[color-mix(in_srgb,var(--paper-2)_45%,transparent)]"}`}
    >
      {/* The cell is named by its content, not aria-label: its marks are drawn inside it, and a name must hold what it draws. */}
      <span className="sr-only">{cellLabel(cell)}</span>
      <span aria-hidden="true" className="flex items-center justify-center @min-[36rem]/month:justify-start">
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 font-display text-[15px] tabular ${
            isToday ? "bg-ink font-semibold text-paper" : inMonth ? "font-medium text-ink" : "text-ink-3"
          }`}
        >
          {number}
        </span>
        {allDone && (
          <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="mr-1 ml-auto hidden text-ink-3 @min-[36rem]/month:block">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        )}
        {number === 1 && <span className="ml-1 hidden text-xs text-ink-3 @min-[36rem]/month:inline">{formatDayHeading(cell.date).split(" ").at(-1)?.slice(0, 3)}</span>}
      </span>

      {/* Quick add for a pointer: on hover and focus, or on the chosen day where there is no hover. It stays out of the cell's name and
          the tab order; a keyboard adds with + on the day, and a phone from the list under the grid. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        title="Add to this day"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className={`absolute top-1 right-1 hidden size-6 items-center justify-center rounded-full text-ink-2 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-focus-within/day:opacity-100 group-hover/day:opacity-100 @min-[36rem]/month:flex pointer-coarse:size-9 ${
          active ? "opacity-0 pointer-coarse:opacity-100" : "pointer-events-none opacity-0 group-hover/day:pointer-events-auto pointer-coarse:hidden"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>

      {cell.marks.length > 0 && (
        <span aria-hidden="true" className="mt-1 flex items-center justify-center gap-[3px] @min-[36rem]/month:hidden">
          {cell.marks.slice(0, shown).map((m) => (
            <Dot key={`${m.key}-${m.due}`} state={m.state} />
          ))}
          {more > 0 && <span className="text-[11px] leading-none text-ink-3 tabular">+{more}</span>}
        </span>
      )}

      <ul className="mt-1 hidden min-w-0 gap-px @min-[36rem]/month:grid">
        {children}
      </ul>
      {more > 0 && (
        <Link
          href={href}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="mt-auto hidden self-start rounded px-1 text-xs font-medium text-ink-2 hover:bg-hover hover:text-ink @min-[36rem]/month:inline"
        >
          +{more} more
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
  quickProps,
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
  quickProps: ReturnType<typeof rowProps>;
}) {
  const label = monthMarkName(mark, variant);
  const shape =
    variant === "cell"
      ? "flex h-[22px] items-center gap-1 rounded px-0.5 text-xs"
      : "flex min-h-11 items-center gap-2 rounded-md px-1.5 text-sm";
  return (
    <div
      data-item={mark.key}
      {...quickProps}
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
