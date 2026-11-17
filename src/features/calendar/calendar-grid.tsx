"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AreaLabel } from "@/components/area-mark";
import { Floating } from "@/components/floating";
import type { AreaColor } from "@/domain/area-color";
import { repeats, type Area, type LocalDate, type ShownItem } from "@/domain/item";
import { useQuick, type RowHooks } from "@/features/actions/context";
import type { QuickItem } from "@/features/actions/model";
import { quickItem } from "@/features/actions/quick-item";
import { rowProps } from "@/features/actions/row-actions";
import { SameInInbox } from "@/features/inbox/same-in-inbox";
import type { ActionResult, CaptureResult } from "@/features/today/commands";
import { DoneToggle } from "@/features/today/done-toggle";
import { dueWords } from "@/features/today/due";
import { DueMark } from "@/features/today/due-mark";
import { formatDayHeading } from "@/features/today/format";
import { STATE_WORD } from "@/features/today/item-name";
import { EMPTY_TRAY, INBOX, stateOf, TRAY_FULL, type BeamState } from "@/features/today/model";
import { RepeatMark } from "@/features/today/repeat-mark";
import { formatHour, formatMinutes, type Clock } from "@/lib/clock";
import { utcMidnight } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";
import type { Box } from "@/lib/placement";
import styles from "./calendar.module.css";
import { DEFAULT_MINUTES, keyPlacement, toAnyTime, wallSpan, type KeyContext, type Placement, type Slot } from "./grid-drop";
import { blockBox, DAY_MINUTES, emptyDayRange, fitHourPx, gridHeight, layoutGrid, openMinute, rangeSpans, scaleOf, segmentOn, visibleRange, yAt, type Block, type CalendarMode } from "./grid-layout";
import { QuickCreate } from "./quick-create";
import { useGridDrag, type DragPreview } from "./use-grid-drag";

/** An example block for an account's first day: drawn faint, never stored, never a target. Minutes from midnight. */
export type GridExample = { title: string; start: number; end: number; color: AreaColor | null };

export type CalendarGridProps = {
  /** The days drawn as columns, in order: one, three or seven. */
  days: readonly LocalDate[];
  /** Everything planned on those days: timed items, any-time items and series occurrences. Others are ignored. */
  items: readonly ShownItem[];
  /** The real today, for the marked column, the now line and due marks. */
  today: LocalDate;
  /** The reader's clock, for the hour gutter and every time written. */
  clock: Clock;
  /** Which span this is; it names the grid and sets how narrow a day column may get. */
  mode: CalendarMode;
  timeZone: string;
  now: Date;
  areas: readonly Area[];
  childCounts?: Record<string, ChildCount>;
  tags?: Record<string, readonly string[]>;
  /** The item the detail panel shows. */
  selectedId?: string | null;
  /** Focus: everything but what is happening now steps back. */
  dim?: boolean;
  /** The Inbox, as a tray under the grid: drag one onto a day or a time to plan it, and a block back to clear its day. */
  tray?: { items: readonly ShownItem[]; full: boolean };
  /** Where the Inbox is drawn instead of under the grid (the Day's side column). Null: not drawn yet, its place is not mounted. Left out: under the grid. */
  trayHost?: HTMLElement | null;
  /** Faint examples on today's column (or the first), for an account that has stored nothing yet. */
  examples?: readonly GridExample[];
  /** The length a new item, or one given a time, gets. */
  defaultMinutes?: number;
  /** Opens the detail panel for an item, or closes it with null. */
  onSelect: (id: string | null) => void;
  /** Saves where an item sits: a move, a resize, to or from the any-time row. */
  onPlace: (item: ShownItem, placement: Placement) => void;
  onToggleDone: (item: ShownItem) => void;
  /** The capture command: takes a line of plain English and plans what it says. */
  onCapture: (text: string) => Promise<CaptureResult | ActionResult>;
  /** After a capture from the grid saved, so the screen can say what was added. */
  onCaptured?: (result: CaptureResult | ActionResult, text: string) => void;
  className?: string;
};

const KEYS_ID = "calendar-keys";
const MODE_NAME: Record<CalendarMode, string> = { day: "Day", "3day": "Three days", week: "Week" };
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const NO_AREA = "No area";
/** The rows the any-time strip takes before it folds the rest under a "+N more" button. */
const ANY_ROWS = 3;
/** The height of the "Earlier hours" and "Later hours" rows at the ends of the grid. */
const EXPANDER_PX = 28;
/** The page keeps this much under the grid when the grid is fitted to the window. */
const BOTTOM_GAP = 16;

type Peek = { id: string; at: Box };
type Creating = { slot: Slot; at: Box };

/** The narrowest an overlapping block may be drawn; in a column too narrow for that, the blocks overlap a little instead of becoming slivers. */
const MIN_SHARE = "76px";

/** Where overlapping blocks sit in their column: side by side, or staggered when the column is too narrow to share. */
function sideBySide(b: { column: number; columns: number }, box: { left: number; width: number }): CSSProperties {
  if (b.columns < 2) return { left: "2px", width: "calc(100% - 4px)" };
  return {
    left: `calc(min(${box.left * 100}%, (100% - ${MIN_SHARE}) * ${b.column / (b.columns - 1)}) + 2px)`,
    width: `max(calc(${box.width * 100}% - 4px), ${MIN_SHARE})`,
  };
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

export function CalendarGrid({
  days,
  items,
  today,
  clock,
  mode,
  timeZone,
  now,
  areas,
  childCounts = {},
  tags = {},
  selectedId = null,
  dim = false,
  tray,
  trayHost,
  examples = [],
  defaultMinutes = DEFAULT_MINUTES,
  onSelect,
  onPlace,
  onToggleDone,
  onCapture,
  onCaptured,
  className = "",
}: CalendarGridProps) {
  const quick = useQuick();
  const scroller = useRef<HTMLDivElement>(null);
  const refocus = useRef<{ id: string; until: number } | null>(null);
  /** Set by a double-click, so the press that ended it does not also open the block in brief. */
  const straightToPanel = useRef(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [creating, setCreating] = useState<Creating | null>(null);
  /** Where the keyboard's slot sits, the same on every day. */
  const [cursor, setCursor] = useState(9 * 60);
  /** The days whose any-time row is opened out past three rows. */
  const [anyOpen, setAnyOpen] = useState<Set<LocalDate>>(new Set());

  /** The hours past the default range that the reader opened out, at either end. */
  const [earlier, setEarlier] = useState(false);
  const [later, setLater] = useState(false);
  /** On a desktop window: the height the grid is given so the page itself does not scroll (null on a phone), and the head's height. */
  const [fit, setFit] = useState<{ height: number; head: number } | null>(null);

  // The hours drawn: from an hour before the first planned thing, or 07:00, to an hour after the last, or 22:00.
  const nowMinutes = useMemo(() => layoutGrid({ days, items: [], timeZone, now }).now?.minutes ?? null, [days, timeZone, now]);
  const hoursShown = useMemo(() => {
    const spans = rangeSpans(days, items, timeZone);
    // A day with nothing timed on it draws a short range around now, not fifteen hours of blank lines.
    if (mode === "day" && spans.length === 0) return emptyDayRange(nowMinutes, { earlier, later });
    return visibleRange(spans, nowMinutes === null ? null : Math.floor(nowMinutes / 60) * 60, { earlier, later });
  }, [mode, days, items, timeZone, nowMinutes, earlier, later]);
  const showEarlier = hoursShown.from > 0 || earlier;
  const showLater = hoursShown.to < DAY_MINUTES || later;
  const hourPx = fitHourPx(
    (hoursShown.to - hoursShown.from) / 60,
    fit ? fit.height - fit.head - (showEarlier ? EXPANDER_PX : 0) - (showLater ? EXPANDER_PX : 0) - 2 : null,
  );
  const scale = useMemo(() => scaleOf(hoursShown.from, hoursShown.to, hourPx), [hoursShown.from, hoursShown.to, hourPx]);
  const layout = useMemo(() => layoutGrid({ days, items, timeZone, now, scale }), [days, items, timeZone, now, scale]);
  const nowAt = layout.now;
  const byId = useMemo(() => new Map(items.map((i) => [i.id as string, i])), [items]);
  const areaOf = (item: ShownItem) => areas.find((a) => a.id === item.areaId) ?? null;
  /** The day a tray item is given from the keyboard, and where examples are drawn: today when it shows, else the first day. */
  const anchor = days.includes(today) ? today : days[0];
  const keyCtx: KeyContext = { days, timeZone, now: nowAt?.minutes ?? null, today, fallback: defaultMinutes };

  const columnEl = (day: LocalDate) => scroller.current?.querySelector<HTMLElement>(`[data-day-col="${day}"]`) ?? null;

  function openSlot(slot: Slot) {
    const col = columnEl(slot.day)?.getBoundingClientRect();
    if (!col) return;
    setPeek(null);
    setCreating({ slot, at: { left: col.left + 2, top: col.top + yAt(slot.start, scale), width: col.width - 4, height: slot.length * scale.ppm } });
  }

  const start = useGridDrag(
    scroller,
    {
      timeZone,
      fallback: defaultMinutes,
      scale,
      onDrop: onPlace,
      onTap: (item, from) => {
        if (!straightToPanel.current) setPeek({ id: item.id, at: boxOf(from) });
      },
      onSlot: openSlot,
    },
    setPreview,
  );

  // Open on now, or on the morning of a day that is not today. Again when the days shown change.
  const span = days.join();
  // The scroll the grid set itself, so a scroll by the reader can be told apart: after that it stays where they put it.
  const opened = useRef<{ span: string; top: number; moved: boolean }>({ span: "", top: 0, moved: false });
  const fitHeight = fit?.height;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fresh = opened.current.span !== span;
    if (fresh) opened.current = { span, top: 0, moved: false };
    if (opened.current.moved) return;
    const minute = openMinute(nowMinutes === null ? null : { day: 0, minutes: nowMinutes, top: 0 }, hoursShown.from);
    // On the top of the range the Earlier hours row stays in view; below it, the row is scrolled past.
    const top = minute <= hoursShown.from ? 0 : Math.max(0, Math.round(yAt(minute, scale) + (showEarlier ? EXPANDER_PX : 0)));
    if (window.matchMedia("(max-width: 759.98px)").matches) {
      // A phone: the page scrolls, not the grid. Once per set of days, put that minute just under the sticky head.
      if (!fresh) return;
      const stuck = parseFloat(getComputedStyle(el.querySelector("[data-head]")!).top) || 0;
      let set = -1;
      const put = () => {
        // The page above can still be settling (streamed cards, fonts): measure again, until the reader scrolls themselves.
        if (set >= 0 && Math.abs(window.scrollY - set) > 2) return;
        const to = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY + top - stuck - (top > 0 ? 8 : 0)));
        window.scrollTo(0, to);
        set = window.scrollY;
      };
      put();
      const timers = [150, 450, 1000].map((ms) => window.setTimeout(put, ms));
      return () => timers.forEach(window.clearTimeout);
    }
    el.scrollTop = top;
    opened.current.top = el.scrollTop;
    // Not on every tick of now: later renders keep wherever the reader scrolled to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span, scale.ppm, scale.from, fitHeight]);

  // On a desktop window the grid is given the height left under the page's head, so the page itself does not scroll
  // and the grid is the one place that does. A phone lets the page scroll as one, with the day heads sticky.
  useLayoutEffect(() => {
    const el = scroller.current;
    const section = el?.parentElement;
    if (!el || !section) return;
    const wide = window.matchMedia("(min-width: 760px)");
    function measure() {
      if (!el || !section) return;
      if (!wide.matches) {
        document.documentElement.style.removeProperty("--calendar-fit");
        setFit((f) => (f === null ? f : null));
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      let below = section.offsetHeight - el.offsetHeight;
      for (let n = section.nextElementSibling; n; n = n.nextElementSibling) below += (n as HTMLElement).offsetHeight || 0;
      const height = Math.max(352, Math.floor(window.innerHeight - top - below - BOTTOM_GAP));
      const head = el.querySelector<HTMLElement>("[data-head]")?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--calendar-fit", `${height}px`);
      setFit((f) => (f && f.height === height && f.head === head ? f : { height, head }));
    }
    measure();
    window.addEventListener("resize", measure);
    const watch = new ResizeObserver(measure);
    watch.observe(document.body);
    watch.observe(el.querySelector("[data-head]")!);
    wide.addEventListener("change", measure);
    return () => {
      window.removeEventListener("resize", measure);
      watch.disconnect();
      wide.removeEventListener("change", measure);
      document.documentElement.style.removeProperty("--calendar-fit");
    };
  }, []);

  // After a key moved a block, focus follows it to where it was drawn again.
  useEffect(() => {
    const want = refocus.current;
    if (!want) return;
    // A move to another day takes the block out of one column and draws it in the next, a render or two after
    // the key. Finding the old element must not end the watch, so it runs until the reader moves on, or a moment passes.
    const active = document.activeElement;
    const el = document.querySelector<HTMLElement>(`[data-nav][data-id="${want.id}"]`);
    const movedOn = active !== null && active !== document.body && active !== el && active.isConnected;
    if (movedOn || performance.now() > want.until) {
      refocus.current = null;
      return;
    }
    if (el && active !== el) el.focus();
  });

  const quickOf = (item: ShownItem): { item: QuickItem; hooks: RowHooks } => ({
    item: { ...quickItem(item, timeZone), title: quick?.patched(item.id)?.title ?? item.title },
    hooks: { onOpen: () => onSelect(item.id), onToggleDone: () => onToggleDone(item) },
  });

  /** Plain arrows walk the grid: up and down through a day, left and right to the nearest thing on the next day. */
  function moveFocus(from: HTMLElement, key: string) {
    const root = scroller.current;
    const day = from.dataset.day as LocalDate | undefined;
    if (!root || !day) return false;
    const on = (d: LocalDate) => [...root.querySelectorAll<HTMLElement>(`[data-nav][data-day="${d}"]`)];
    if (key === "ArrowUp" || key === "ArrowDown") {
      const list = on(day);
      const next = list[list.indexOf(from) + (key === "ArrowDown" ? 1 : -1)];
      next?.focus();
      return true;
    }
    if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
    const to = days[days.indexOf(day) + (key === "ArrowRight" ? 1 : -1)];
    if (!to) return true;
    const at = Number(from.dataset.start ?? 0);
    const nearest = on(to).sort((a, b) => Math.abs(Number(a.dataset.start) - at) - Math.abs(Number(b.dataset.start) - at))[0];
    (nearest ?? root.querySelector<HTMLElement>(`[data-slot-cursor="${to}"]`))?.focus();
    return true;
  }

  function keyDown(e: KeyboardEvent<HTMLElement>, item: ShownItem) {
    if (quick) {
      const q = quickOf(item);
      if (quick.keyDown(e, q.item, q.hooks)) return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      onSelect(item.id);
    } else if (e.key === " ") {
      e.preventDefault();
      setPeek({ id: item.id, at: boxOf(e.currentTarget) });
    } else if (e.altKey || e.shiftKey) {
      const placement = keyPlacement(keyCtx, item, e);
      if (!placement) return;
      e.preventDefault();
      refocus.current = { id: item.id, until: e.timeStamp + 3000 };
      onPlace(item, placement);
    } else if (moveFocus(e.currentTarget, e.key)) {
      e.preventDefault();
    }
  }

  /** An item in the tray has no day to walk from: Up gives it one, the day the grid is about, at any time. */
  function trayKey(e: KeyboardEvent<HTMLElement>, item: ShownItem) {
    if (quick) {
      const q = quickOf(item);
      if (quick.keyDown(e, q.item, q.hooks)) return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      onSelect(item.id);
    } else if (e.key === " ") {
      e.preventDefault();
      setPeek({ id: item.id, at: boxOf(e.currentTarget) });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      refocus.current = { id: item.id, until: e.timeStamp + 3000 };
      onPlace(item, toAnyTime(anchor));
    }
  }

  function cursorKey(e: KeyboardEvent<HTMLButtonElement>, day: LocalDate) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.shiftKey ? 15 : 30;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(hoursShown.from, Math.min(hoursShown.to - step, cursor + (e.key === "ArrowDown" ? step : -step)));
      setCursor(next);
      const el = scroller.current;
      // Keep the slot in view under the sticky head as it travels.
      if (el) {
        const head = el.querySelector<HTMLElement>("[data-head]")?.offsetHeight ?? 0;
        const top = (m: number) => yAt(m, scale) + (showEarlier ? EXPANDER_PX : 0);
        if (top(next) < el.scrollTop) el.scrollTop = top(next);
        else if (top(next + 60) > el.scrollTop + el.clientHeight - head) el.scrollTop = top(next + 60) - el.clientHeight + head;
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const to = days[days.indexOf(day) + (e.key === "ArrowRight" ? 1 : -1)];
      if (to) scroller.current?.querySelector<HTMLElement>(`[data-slot-cursor="${to}"]`)?.focus();
    }
  }

  const range = (from: number, to: number) => `${formatMinutes(from, clock)} to ${formatMinutes(to, clock)}`;

  /** What a block or chip says and shows. The name leads with the words drawn on it, in the order drawn (Label in Name). */
  function wordsOf(item: ShownItem, state: BeamState, roomy: boolean) {
    const s = wallSpan(item, timeZone);
    const day = s?.day ?? (item.schedule.kind === "day" ? item.schedule.on : today);
    const count = childCounts[item.id];
    const due = state !== "done" && item.dueOn ? item.dueOn : null;
    const time = s ? (roomy ? range(s.start, s.end) : formatMinutes(s.start, clock)) : null;
    const shown = [item.title, time, roomy && count && `${count.done}/${count.total}`, roomy && due && dueWords(due, today).words];
    const said = [
      s && !roomy && `to ${formatMinutes(s.end, clock)}`,
      !s && "any time",
      formatDayHeading(day),
      areaOf(item)?.name ?? NO_AREA,
      STATE_WORD[state],
      repeats(item) && "repeats",
      count && `${count.done} of ${count.total} subtasks done`,
      !roomy && due && dueWords(due, today).words,
      tags[item.id]?.length ? `tagged ${tags[item.id].join(", ")}` : null,
    ];
    return { time, count: roomy && count ? `${count.done}/${count.total}` : null, due: roomy ? due : null, name: [shown.filter(Boolean).join(" "), ...said.filter(Boolean)].join(", ") };
  }

  function face({ item, state, day, startAt, roomy, stack, onPointerDown }: { item: ShownItem; state: BeamState; day: LocalDate; startAt: number; roomy: boolean; stack: boolean; onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void }) {
    const q = quickOf(item);
    const words = wordsOf(item, state, roomy);
    const { onKeyDown: _keys, ...row } = rowProps(quick, q.item, q.hooks) as { onKeyDown?: unknown };
    void _keys;
    return (
      <>
        <button
          type="button"
          {...row}
          data-nav
          data-id={item.id}
          data-day={day}
          data-start={startAt}
          aria-label={words.name}
          aria-describedby={KEYS_ID}
          aria-haspopup="dialog"
          className={`${styles.face} ${stack ? styles.stack : ""}`}
          onPointerDown={onPointerDown}
          onKeyDown={(e) => keyDown(e, item)}
          onDoubleClick={() => {
            // The second press's own tap is still waiting its turn; it comes before this is cleared.
            straightToPanel.current = true;
            window.setTimeout(() => (straightToPanel.current = false), 0);
            setPeek(null);
            onSelect(item.id);
          }}
          // A click with no pointer behind it: a screen reader or voice control pressing the button.
          onClick={(e) => e.detail === 0 && setPeek({ id: item.id, at: boxOf(e.currentTarget) })}
        >
          {/* One element holds every word drawn, so a block scrolled half out of view is judged whole (Label in Name). */}
          <span className={styles.words}>
            <span className={styles.title}>{q.item.title}</span>
            {words.time && <> <span className={styles.meta}>{words.time}</span></>}
            {(repeats(item) || words.count || words.due) && (
              <span className={styles.meta}>
                {repeats(item) && <> <RepeatMark /></>}
                {words.count && <> {words.count}</>}
                {words.due && <> <DueMark dueOn={words.due} today={today} className="text-inherit!" /></>}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={state === "done"}
          aria-label={`Done: ${q.item.title}`}
          className={styles.tick}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleDone(item)}
        >
          <span className={styles.mark} />
        </button>
      </>
    );
  }

  const tint = (item: ShownItem): CSSProperties | undefined => {
    const color = areaOf(item)?.color;
    return color ? ({ "--tint": `var(--area-${color})` } as CSSProperties) : undefined;
  };
  const hidden = (item: ShownItem) => quick?.patched(item.id)?.hidden;
  const lifted = (item: ShownItem) => preview?.kind === "move" && preview.item.id === item.id;

  const block = (b: Block, day: LocalDate) => {
    const { item } = b;
    if (hidden(item)) return null;
    const state = stateOf(item, now);
    const box = blockBox(b);
    const short = b.height < 34;
    const cls = [
      styles.block,
      styles[state],
      areaOf(item)?.color ? "" : styles.plain,
      short ? styles.short : "",
      selectedId === item.id ? styles.selected : "",
      lifted(item) ? styles.lifted : "",
      b.before ? styles.continuesBefore : "",
      b.after ? styles.continuesAfter : "",
    ].join(" ");
    return (
      <div
        key={item.id}
        data-item={item.id}
        data-state={state}
        className={cls}
        style={{ ...tint(item), top: b.top, height: b.height - 1, ...sideBySide(b, box) }}
      >
        {face({ item, state, day, startAt: b.start, roomy: !short, stack: b.height >= 50, onPointerDown: (e) => start(e, "move", day, item) })}
        {!b.after && <span className={styles.grip} aria-hidden="true" onPointerDown={(e) => start(e, "resize", day, item)} />}
      </div>
    );
  };

  /** Where a drag would land, drawn on each day it touches. */
  const ghostOn = (day: LocalDate) => {
    if (preview?.kind === "create" || (creating && !preview)) {
      const slot = preview?.kind === "create" ? preview.slot : creating!.slot;
      if (slot.day !== day) return null;
      return (
        <div className={styles.ghost} data-ghost style={{ top: yAt(slot.start, scale), height: Math.max(18, slot.length * scale.ppm) }}>
          {range(slot.start, slot.start + slot.length)}
        </div>
      );
    }
    if (!preview || !preview.placement) return null;
    const seg = segmentOn({ ...preview.item, schedule: preview.placement.schedule }, day, timeZone);
    if (!seg) return null;
    const s = wallSpan({ ...preview.item, schedule: preview.placement.schedule }, timeZone)!;
    return (
      <div className={styles.ghost} data-ghost style={{ top: yAt(seg.start, scale), height: Math.max(18, (seg.end - seg.start) * scale.ppm) }}>
        {range(s.start, s.end)}
      </div>
    );
  };
  const overAny = (day: LocalDate) =>
    preview?.kind === "move" && preview.placement?.schedule.kind === "day" && preview.placement.schedule.on === day && preview.item.schedule.kind !== "day";

  const overTray = preview?.kind === "move" && preview.placement?.schedule.kind === "unscheduled" && preview.item.schedule.kind !== "unscheduled";

  const trayChip = (item: ShownItem) => {
    if (hidden(item)) return null;
    const state = stateOf(item, now);
    const q = quickOf(item);
    const count = childCounts[item.id];
    const due = state !== "done" && item.dueOn ? item.dueOn : null;
    const { onKeyDown: _keys, ...row } = rowProps(quick, q.item, q.hooks) as { onKeyDown?: unknown };
    void _keys;
    const said = [
      "in the Inbox",
      areaOf(item)?.name ?? NO_AREA,
      STATE_WORD[state],
      repeats(item) && "repeats",
      count && `${count.done} of ${count.total} subtasks done`,
      due && dueWords(due, today).words,
      tags[item.id]?.length ? `tagged ${tags[item.id].join(", ")}` : null,
    ];
    return (
      <li
        key={item.id}
        data-item={item.id}
        data-state={state}
        className={`${styles.chip} ${styles.trayChip} ${styles[state]} ${areaOf(item)?.color ? "" : styles.plain} ${selectedId === item.id ? styles.selected : ""} ${lifted(item) ? styles.lifted : ""}`}
        style={tint(item)}
      >
        <button
          type="button"
          {...row}
          data-nav
          data-id={item.id}
          aria-label={[q.item.title, ...said.filter(Boolean)].join(", ")}
          aria-describedby={KEYS_ID}
          aria-haspopup="dialog"
          className={styles.face}
          onPointerDown={(e) => start(e, "move", anchor, item)}
          onKeyDown={(e) => trayKey(e, item)}
          onDoubleClick={() => {
            straightToPanel.current = true;
            window.setTimeout(() => (straightToPanel.current = false), 0);
            setPeek(null);
            onSelect(item.id);
          }}
          onClick={(e) => e.detail === 0 && setPeek({ id: item.id, at: boxOf(e.currentTarget) })}
        >
          <span className={styles.words}>
            <span className={styles.title}>{q.item.title}</span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={state === "done"}
          aria-label={`Done: ${q.item.title}`}
          className={styles.tick}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleDone(item)}
        >
          <span className={styles.mark} />
        </button>
      </li>
    );
  };

  const trayNode =
    tray && examples.length === 0 ? (
      <section data-drop="tray" aria-labelledby="calendar-tray-h" className={`${styles.tray} ${trayHost ? styles.trayRail : ""} ${overTray ? styles.over : ""}`}>
        <TrayHeading as={trayHost ? "h2" : "h3"}>
          {INBOX}
        </TrayHeading>
        {tray.items.length === 0 && !tray.full ? (
          <p className="mt-1 text-[13px] text-ink-3">Empty. What you capture lands here first.</p>
        ) : (
        <>
        <p className="mt-1 mb-3 text-[13px] text-ink-3">
          No day yet. <span className="pointer-coarse:hidden">Drag one onto the grid to plan it for that time{trayHost ? ", or click it to plan it for today. " : ". Drag a block back here to clear its day. "}</span>
          <span className="hidden pointer-coarse:inline">Press and hold one, then drag it onto a day to plan it for that time. </span>
          <SameInInbox />
        </p>
        {tray.items.length ? <ul className={`flex flex-wrap gap-2 ${trayHost ? styles.trayList : ""}`}>{tray.items.map(trayChip)}</ul> : <p className="text-[13px] text-ink-3">{EMPTY_TRAY}</p>}
        {tray.full && <p className="mt-3 text-[13px] text-ink-3">{TRAY_FULL}</p>}
        </>
        )}
      </section>
    ) : null;
  const peeked = peek ? byId.get(peek.id) : undefined;
  const hours = Array.from({ length: Math.max(0, (hoursShown.to - hoursShown.from) / 60 - 1) }, (_, i) => hoursShown.from / 60 + i + 1);

  return (
    <section aria-labelledby="calendar-grid-h" className={`surface overflow-clip [--paper:var(--sheet)] ${className}`}>
      <h2 id="calendar-grid-h" className="sr-only">
        {MODE_NAME[mode]} calendar
      </h2>
      <div
        ref={scroller}
        data-calendar-grid={mode}
        data-from={hoursShown.from}
        className={`${styles.frame} ${mode === "week" ? styles.week : ""} ${dim ? styles.dim : ""} ${fit ? styles.fit : ""}`}
        onScroll={(e) => {
          if (Math.abs(e.currentTarget.scrollTop - opened.current.top) > 3) opened.current.moved = true;
        }}
        style={{ "--days": days.length, "--hour": `${hourPx}px`, ...(fit ? { height: fit.height } : {}) } as CSSProperties}
      >
        <div className={styles.head} data-head>
          <div className={styles.corner} />
          {days.map((day) => (
            <h3 key={day} className={`${styles.dayHead} ${day === today ? styles.today : ""}`} aria-current={day === today ? "date" : undefined}>
              <time dateTime={day} aria-label={`${formatDayHeading(day)}${day === today ? ", today" : ""}`}>
                <span className={styles.dayName}>{weekday.format(utcMidnight(day))}</span> <span className={styles.dayNum}>{Number(day.slice(8))}</span>
              </time>
            </h3>
          ))}
          <div className={styles.anyLabel}>Any time</div>
          {layout.columns.map((col) => (
            <div key={col.date} data-anytime={col.date} className={`${styles.anyCell} ${overAny(col.date) ? styles.over : ""}`}>
              {col.anyTime.length > 0 && (
                <ul aria-label={`Any time, ${formatDayHeading(col.date)}`} className={anyOpen.has(col.date) ? styles.anyOpen : undefined}>
                  {col.anyTime.filter((i) => !hidden(i)).map((item, at, all) => {
                    const state = stateOf(item, now);
                    const folded = all.length > ANY_ROWS && at >= ANY_ROWS - 1 && !anyOpen.has(col.date);
                    return (
                      <li
                        key={item.id}
                        data-item={item.id}
                        data-state={state}
                        className={`${styles.chip} ${folded ? styles.anyFolded : ""} ${styles[state]}${areaOf(item)?.color ? "" : styles.plain} ${selectedId === item.id ? styles.selected : ""} ${lifted(item) ? styles.lifted : ""}`}
                        style={tint(item)}
                      >
                        {face({ item, state, day: col.date, startAt: -1, roomy: false, stack: false, onPointerDown: (e) => start(e, "move", col.date, item) })}
                      </li>
                    );
                  })}
                  {(() => {
                    const total = col.anyTime.filter((i) => !hidden(i)).length;
                    if (total <= ANY_ROWS) return null;
                    const open = anyOpen.has(col.date);
                    return (
                      <li className={styles.anyMoreRow}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setAnyOpen((s) => { const n = new Set(s); if (open) n.delete(col.date); else n.add(col.date); return n; })}
                          className={styles.anyMore}
                        >
                          {open ? "Show fewer" : `+${total - (ANY_ROWS - 1)} more`}
                        </button>
                      </li>
                    );
                  })()}
                </ul>
              )}
            </div>
          ))}
        </div>

        {showEarlier && (
          <button type="button" data-expand="earlier" aria-expanded={earlier} className={styles.expander} onClick={() => setEarlier((v) => !v)}>
            {earlier ? "Hide earlier hours" : "Earlier hours"}
          </button>
        )}
        <div className={styles.body} style={{ height: gridHeight(scale) }}>
          <div className={styles.gutter} aria-hidden="true">
            {hours.map((h) => (
              <span key={h} data-hour={h} className={styles.hour} style={{ top: yAt(h * 60, scale), visibility: nowAt && Math.abs(nowAt.minutes - h * 60) < 14 ? "hidden" : undefined }}>
                {formatHour(h, clock)}
              </span>
            ))}
            {nowAt && (
              <span className={`${styles.hour} ${styles.nowLabel}`} style={{ top: nowAt.top }}>
                {formatMinutes(nowAt.minutes, clock).replace(/\s?[AP]M$/, "")}
              </span>
            )}
          </div>
          {layout.columns.map((col, i) => (
            <div
              key={col.date}
              role="group"
              aria-label={formatDayHeading(col.date)}
              data-day-col={col.date}
              className={`${styles.col} ${col.date === today ? styles.colToday : ""}`}
              onPointerDown={(e) => e.target === e.currentTarget && start(e, "create", col.date, null)}
            >
              <button
                type="button"
                data-slot-cursor={col.date}
                className={styles.cursor}
                style={{ top: yAt(cursor, scale), height: 30 * scale.ppm }}
                aria-label={`New item, ${formatDayHeading(col.date)}, ${formatMinutes(cursor, clock)}`}
                aria-describedby={KEYS_ID}
                onKeyDown={(e) => cursorKey(e, col.date)}
                onClick={() => openSlot({ day: col.date, start: cursor, length: defaultMinutes })}
              />
              {col.date === anchor &&
                examples.map((ex) => (
                  <div
                    key={ex.title}
                    aria-hidden="true"
                    data-example
                    className={styles.example}
                    style={{ ...(ex.color ? ({ "--tint": `var(--area-${ex.color})` } as CSSProperties) : {}), top: yAt(ex.start, scale), height: (ex.end - ex.start) * scale.ppm - 1 }}
                  >
                    {ex.title} <span className={styles.meta}>{range(ex.start, ex.end)}</span>
                  </div>
                ))}
              {mode === "day" && col.blocks.length === 0 && examples.length === 0 && (
                <p
                  aria-hidden="true"
                  data-empty-day
                  className={styles.emptyDay}
                  style={{ top: nowAt?.day === i ? nowAt.top + 16 : yAt(scale.from + 120, scale) + 6 }}
                >
                  Nothing planned. Click a time to add something, or drag from the Inbox.
                </p>
              )}
              {col.blocks.map((b) => block(b, col.date))}
              {ghostOn(col.date)}
              {nowAt?.day === i && (
                <>
                  <div className={styles.now} data-now aria-hidden="true" style={{ top: nowAt.top }} />
                  <div className={styles.nowDot} aria-hidden="true" style={{ top: nowAt.top }} />
                </>
              )}
            </div>
          ))}
        </div>
        {showLater && (
          <button type="button" data-expand="later" aria-expanded={later} className={styles.expander} onClick={() => setLater((v) => !v)}>
            {later ? "Hide later hours" : "Later hours"}
          </button>
        )}
      </div>

      {trayNode && (trayHost === undefined ? trayNode : trayHost ? createPortal(trayNode, trayHost) : null)}

      <p id={KEYS_ID} className="sr-only">
        Arrow keys move between items. Enter opens one, Space shows it in brief, D marks it done. Alt with Up or Down moves it a quarter
        hour, Alt with Left or Right a day, Shift with Up or Down changes its length, Alt Home takes its time away, and Alt Down gives an
        any-time item a time. On an empty slot, Up and Down choose the time and Enter adds an item there. On an item in the Inbox, Up gives it a day.
      </p>

      {peek && peeked && (
        <BlockPeek
          key={peek.id}
          at={peek.at}
          item={peeked}
          state={stateOf(peeked, now)}
          area={areaOf(peeked)}
          when={(() => {
            const s = wallSpan(peeked, timeZone);
            return s ? `${formatDayHeading(s.day)}, ${range(s.start, s.end)}` : `${formatDayHeading(peeked.schedule.kind === "day" ? peeked.schedule.on : today)}, any time`;
          })()}
          today={today}
          canDelete={quick !== null}
          onClosed={(back) => {
            const id = peek.id;
            setPeek(null);
            if (back) document.querySelector<HTMLElement>(`[data-nav][data-id="${id}"]`)?.focus();
          }}
          onToggleDone={() => onToggleDone(peeked)}
          onPlan={
            peeked.schedule.kind === "unscheduled"
              ? () => {
                  setPeek(null);
                  onPlace(peeked, toAnyTime(anchor));
                }
              : undefined
          }
          planWord={anchor === today ? "Plan for today" : `Plan for ${formatDayHeading(anchor)}`}
          onEdit={() => {
            setPeek(null);
            onSelect(peeked.id);
          }}
          onDelete={() => {
            const face = document.querySelector<HTMLElement>(`[data-nav][data-id="${peek.id}"]`);
            const q = quickOf(peeked);
            setPeek(null);
            if (face) quick?.run("delete", q.item, q.hooks, face);
          }}
        />
      )}

      {creating && (
        <QuickCreate
          key={`${creating.slot.day}-${creating.slot.start}-${creating.slot.length}`}
          slot={creating.slot}
          at={creating.at}
          today={today}
          clock={clock}
          onCapture={onCapture}
          onCaptured={(result, text) => {
            setCreating(null);
            onCaptured?.(result, text);
          }}
          onClosed={(back) => {
            const day = creating.slot.day;
            setCreating(null);
            if (back) scroller.current?.querySelector<HTMLElement>(`[data-slot-cursor="${day}"]`)?.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}

/** The Inbox heading: a section heading of its own in the Day's side column (it comes before the grid in the page), one level under the grid's otherwise. */
function TrayHeading({ as: Tag, children }: { as: "h2" | "h3"; children: ReactNode }) {
  return (
    <Tag id="calendar-tray-h" className="font-display text-lg leading-tight font-medium">
      {children}
    </Tag>
  );
}

/** A block in brief, over the grid: what it is and when, its done tick, and the way on to the panel or to deleting it. */
function BlockPeek({
  at,
  item,
  state,
  area,
  when,
  today,
  canDelete,
  onClosed,
  onToggleDone,
  onEdit,
  onDelete,
  onPlan,
  planWord,
}: {
  at: Box;
  item: ShownItem;
  state: BeamState;
  area: Area | null;
  when: string;
  today: LocalDate;
  canDelete: boolean;
  onClosed: (refocus: boolean) => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlan?: () => void;
  planWord: string;
}) {
  const quiet = "press rounded-md border border-rule px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11";
  return (
    <Floating at={at} label={item.title} onClosed={onClosed} className="w-[min(20rem,calc(100vw-2rem))] p-3.5">
      <h3 className={`font-display text-lg leading-snug font-medium text-balance [overflow-wrap:anywhere] ${state === "done" ? "text-ink-2 line-through decoration-rule" : ""}`}>
        {item.title}
      </h3>
      <p className="mt-1 text-[13px] text-ink-2 tabular">{when}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <AreaLabel name={area?.name ?? NO_AREA} color={area?.color ?? null} />
        {repeats(item) && (
          <span className="inline-flex items-center gap-1">
            <RepeatMark /> Repeats
          </span>
        )}
        {state !== "done" && item.dueOn && <DueMark dueOn={item.dueOn} today={today} />}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-rule-soft pt-2.5">
        <DoneToggle type={item.type} title={item.title} done={state === "done"} justDone={false} onToggle={onToggleDone} />
        <span aria-hidden="true" className="mr-auto text-[13px] text-ink-2">
          {state === "done" ? "Done" : STATE_WORD[state] === "happening now" ? "Happening now" : "Planned"}
        </span>
        {onPlan && (
          <button type="button" data-autofocus className={quiet} onClick={onPlan}>
            {planWord}
          </button>
        )}
        <button type="button" data-autofocus={onPlan ? undefined : ""} className={quiet} onClick={onEdit}>
          Edit
        </button>
        {canDelete && (
          <button type="button" className={quiet} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </Floating>
  );
}
