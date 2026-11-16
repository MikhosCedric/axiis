"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { useClock } from "@/components/shell/clock-context";
import type { Area, LocalDate, ShownItem } from "@/domain/item";
import { selectedIn, type ItemKey } from "@/domain/item-key";
import { useQuick } from "@/features/actions/context";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { placeAction } from "@/features/score/actions";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { capturedLine } from "@/features/today/capture-syntax";
import type { ActionResult, CaptureResult } from "@/features/today/commands";
import { formatDayHeading } from "@/features/today/format";
import { STATE_WORD } from "@/features/today/item-name";
import { buildToday, stateOf } from "@/features/today/model";
import { formatClock } from "@/lib/clock";
import { dayRangeFor, toLocalDate } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";
import { reach } from "@/lib/reach";
import { CalendarGrid, type GridExample } from "./calendar-grid";
import type { Placement } from "./grid-drop";
import type { CalendarMode } from "./grid-layout";

/** Everything the grid draws, loaded on the server and serializable to the client. */
export type CalendarData = {
  timeZone: string;
  today: LocalDate;
  /** The request's "now", so server and client agree on what is live. */
  nowIso: string;
  areas: Area[];
  /** Items planned on the days shown, with the occurrences of every series that fall on them. */
  items: ShownItem[];
  /** The Inbox: items with no day, drawn as a tray under the grid. Left out, the grid has no tray. */
  tray?: ShownItem[];
  /** The Inbox read hit its cap, so older items are not in the tray. */
  trayFull?: boolean;
  childCounts: Record<string, ChildCount>;
  tags: Record<string, readonly string[]>;
};

/** The writes the grid makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type CalendarActions = {
  place: (id: string, placement: Placement) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  capture: (text: string) => Promise<CaptureResult | ActionResult>;
};

const serverActions: CalendarActions = { place: placeAction, setDone: setDoneAction, capture: captureAction };

/** Something a move may offer next, said after it in the status line: "Same time every day". */
export type PlaceOffer = { label: string; run: () => Promise<ActionResult>; said: string };

/**
 * What a page drawn around the grid shares with it: the items as they stand this moment (a change shows
 * before it has saved), the clock, the selection and the two writes a row outside the grid makes too.
 */
export type CalendarContext = {
  items: ShownItem[];
  now: Date;
  today: LocalDate;
  selectedId: string | null;
  /** The item ticked done a moment ago, which keeps its place until the tick has been seen. */
  justDone: string | null;
  select: (id: string | null) => void;
  toggleDone: (item: ShownItem) => void;
  /** Says how something went on the screen's one status line. */
  say: (text: string, error?: boolean) => void;
  /** The status line itself, for the page to put under its capture field. */
  status: ReactNode;
};

type Patch = { id: ItemKey; changes: Partial<Pick<ShownItem, "schedule" | "status" | "completedAt">> };
type Status = { text: string; error: boolean; offer?: PlaceOffer };

function useNow(nowIso: string, ticking: boolean) {
  const [now, setNow] = useState(() => new Date(nowIso));
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [ticking]);
  return now;
}

/**
 * The grid with its saves: each change is drawn at once and put back if it does not save, a move says
 * where the item went and offers Undo, and the detail panel opens beside it by `?item=`.
 *
 * A page (the Day, the Week) passes a function as `children` to lay itself out around the grid: it gets
 * the grid as a node and what the grid knows, and places the status line itself. With no children the
 * grid stands alone over its status line.
 */
export function CalendarView({
  data,
  days,
  mode,
  detail,
  dim = false,
  ticking = true,
  actions = serverActions,
  examples,
  offer,
  className = "",
  children,
}: {
  data: CalendarData;
  days: readonly LocalDate[];
  mode: CalendarMode;
  /** The detail panel for the selected item, drawn by the page. */
  detail?: ReactNode;
  dim?: boolean;
  /** False where now is pinned (a test), so the now line stays put. */
  ticking?: boolean;
  actions?: CalendarActions;
  /** Faint example blocks for an account's first day. */
  examples?: readonly GridExample[];
  /** What to offer after a move saved, if anything. */
  offer?: (item: ShownItem, placement: Placement) => PlaceOffer | null;
  /** For the column the grid and the page around it sit in. */
  className?: string;
  children?: (ctx: CalendarContext, grid: ReactNode) => ReactNode;
}) {
  const { timeZone, areas } = data;
  const clock = useClock();
  const quick = useQuick();
  const { selectedParam, selectedId, select } = useItemSelection();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<Status | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const now = useNow(data.nowIso, ticking && days.includes(data.today));
  const today = ticking ? toLocalDate(now, timeZone) : data.today;
  const saved = useMemo(() => [...data.items, ...(data.tray ?? [])], [data.items, data.tray]);
  const [items, patch] = useOptimistic(saved, (current: ShownItem[], p: Patch) => current.map((i) => (i.id === p.id ? { ...i, ...p.changes } : i)));
  const hasTray = data.tray !== undefined;
  // The tray as the Inbox lists it: open items newest first, and what was ticked done today, so a slip can be undone.
  const tray = useMemo(
    () =>
      hasTray
        ? buildToday(
            { scheduled: [], unscheduled: items.filter((i) => i.schedule.kind === "unscheduled" && i.parentId === null) },
            dayRangeFor(today, timeZone),
            now,
          ).waiting.map((e) => e.item)
        : null,
    [hasTray, items, today, timeZone, now],
  );

  // A ticked item keeps its place for a moment, so the tick is seen, then settles with the rest that are done.
  useEffect(() => {
    if (!justDone) return;
    const id = window.setTimeout(() => setJustDone(null), 4000);
    return () => window.clearTimeout(id);
  }, [justDone]);

  function describe(item: ShownItem, placement: Placement) {
    const s = placement.schedule;
    if (s.kind === "unscheduled") return `${item.title} is in the Inbox, with no day.`;
    if (s.kind === "day") return `${item.title} is on ${formatDayHeading(s.on)}, at any time.`;
    return `${item.title}, ${formatDayHeading(toLocalDate(s.start, timeZone))}, ${formatClock(s.start, timeZone, clock)} to ${formatClock(s.end, timeZone, clock)}.`;
  }

  function place(item: ShownItem, placement: Placement, undoable = true) {
    setStatus(null);
    startTransition(async () => {
      patch({ id: item.id, changes: { schedule: placement.schedule } });
      const result = await reach(actions.place(item.id, placement));
      if (!result.ok) return setStatus({ text: result.error, error: true });
      const text = describe(item, placement);
      setStatus({ text, error: false, offer: (undoable && offer?.(item, placement)) || undefined });
      // The note with Undo, where the page has one; putting it back is the same save, the other way.
      if (undoable) quick?.tell(text, () => place({ ...item, schedule: placement.schedule }, { schedule: item.schedule }, false));
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

  function take(o: PlaceOffer) {
    setStatus(null);
    startTransition(async () => {
      const result = await reach(o.run());
      setStatus(result.ok ? { text: o.said, error: false } : { text: result.error, error: true });
    });
  }

  const statusLine = (
    <p role="status" data-calendar-status className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
      {status?.text}
      {status?.offer && " "}
      {status?.offer && (
        <button
          type="button"
          onClick={() => take(status.offer!)}
          className="-mx-1 rounded px-1 font-medium text-ink underline decoration-rule underline-offset-2 hover:bg-hover hover:decoration-ink active:bg-press"
        >
          {status.offer.label}
        </button>
      )}
    </p>
  );

  const shownSelected = selectedIn(items, selectedId);

  const grid = (
    <CalendarGrid
      days={days}
      items={items}
      today={today}
      clock={clock}
      mode={mode}
      timeZone={timeZone}
      now={now}
      areas={areas}
      childCounts={data.childCounts}
      tags={data.tags}
      selectedId={shownSelected}
      dim={dim}
      tray={tray ? { items: tray, full: data.trayFull ?? false } : undefined}
      examples={examples}
      onSelect={select}
      onPlace={place}
      onToggleDone={toggleDone}
      onCapture={actions.capture}
      onCaptured={(result) => {
        if (result.ok && "id" in result) setStatus({ text: capturedLine(result, "field", clock), error: false });
      }}
    />
  );

  const ctx: CalendarContext = {
    items,
    now,
    today,
    selectedId: shownSelected,
    justDone,
    select,
    toggleDone,
    say: (text, error = false) => setStatus({ text, error }),
    status: statusLine,
  };

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className={`min-w-0 ${className}`}>
        {children ? (
          children(ctx, grid)
        ) : (
          <>
            {grid}
            <div className="mt-2 min-h-6 text-[13px] max-rail:mt-1 max-rail:min-h-5">{statusLine}</div>
          </>
        )}
      </div>
      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}
