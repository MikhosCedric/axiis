"use client";

import { useEffect, useOptimistic, useState, useTransition, type ReactNode } from "react";
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
import { stateOf } from "@/features/today/model";
import { formatClock } from "@/lib/clock";
import { toLocalDate } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";
import { reach } from "@/lib/reach";
import { CalendarGrid } from "./calendar-grid";
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

type Patch = { id: ItemKey; changes: Partial<Pick<ShownItem, "schedule" | "status" | "completedAt">> };

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
 */
export function CalendarView({
  data,
  days,
  mode,
  detail,
  dim = false,
  ticking = true,
  actions = serverActions,
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
}) {
  const { timeZone, areas } = data;
  const clock = useClock();
  const quick = useQuick();
  const { selectedParam, selectedId, select } = useItemSelection();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const now = useNow(data.nowIso, ticking && days.includes(data.today));
  const today = ticking ? toLocalDate(now, timeZone) : data.today;
  const [items, patch] = useOptimistic(data.items, (current: ShownItem[], p: Patch) => current.map((i) => (i.id === p.id ? { ...i, ...p.changes } : i)));

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
      setStatus({ text, error: false });
      // The note with Undo, where the page has one; putting it back is the same save, the other way.
      if (undoable) quick?.tell(text, () => place({ ...item, schedule: placement.schedule }, { schedule: item.schedule }, false));
    });
  }

  function toggleDone(item: ShownItem) {
    const done = item.status !== "done";
    setStatus(null);
    startTransition(async () => {
      patch({ id: item.id, changes: { status: done ? "done" : "open", completedAt: done ? now : null } });
      const result = await reach(actions.setDone(item.id, done));
      const after = stateOf({ ...item, status: done ? "done" : "open" }, now);
      setStatus(result.ok ? { text: `${item.title} is ${STATE_WORD[after]}.`, error: false } : { text: result.error, error: true });
    });
  }

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0">
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
          selectedId={selectedIn(items, selectedId)}
          dim={dim}
          onSelect={select}
          onPlace={place}
          onToggleDone={toggleDone}
          onCapture={actions.capture}
          onCaptured={(result) => {
            if (result.ok && "id" in result) setStatus({ text: capturedLine(result, "field", clock), error: false });
          }}
        />
        <p role="status" data-calendar-status className={`mt-2 min-h-6 text-[13px] ${status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {status?.text}
        </p>
      </div>
      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}
