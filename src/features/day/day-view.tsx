"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import type { ShownItem } from "@/domain/item";
import { selectedIn, type ItemKey } from "@/domain/item-key";
import { setTimeAction } from "@/features/detail/actions";
import { DetailAside } from "@/features/detail/detail-aside";
import type { TimeOfDay } from "@/features/detail/model";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { placeAction } from "@/features/score/actions";
import type { Placement } from "@/features/score/drop";
import { ListView } from "@/features/score/list-view";
import { ScoreView, STATE_WORD } from "@/features/score/score-view";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { CaptureField } from "@/features/today/capture-field";
import { LeftoverStrip } from "./leftover-strip";
import type { LeftoverData } from "./leftover-model";
import type { ActionResult } from "@/features/today/commands";
import { formatDayHeading } from "@/features/today/format";
import { formatClock } from "@/lib/clock";
import { useClock } from "@/components/shell/clock-context";
import { buildToday, stateOf } from "@/features/today/model";
import { dayRangeFor, instantAt, localMinutes, toLocalDate } from "@/lib/dates";
import { FOCUS_COOKIE } from "@/components/shell/cookies";
import { dayGlance, foldedWords } from "./glance";
import { GlanceLine, NextUp } from "./next-up";
import { Tour } from "./tour";
import { seriesTimeOffer, type SeriesTimeOffer } from "./series-time";
import { DAY_VIEW_PARAM, SELECTED_ITEM_PARAM, type DayData, type DayViewMode } from "./types";
import { reach } from "@/lib/reach";

/** The writes the day screen makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type DayActions = {
  place: (id: string, placement: Placement) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
  /** Gives the whole series an occurrence belongs to this time of day. */
  timeSeries: (id: string, time: TimeOfDay) => Promise<ActionResult>;
};

const serverActions: DayActions = {
  place: placeAction,
  setDone: setDoneAction,
  capture: captureAction,
  timeSeries: (id, time) => setTimeAction(id, time, "all"),
};

type Status = { text: string; error: boolean; offer?: SeriesTimeOffer };

type Patch = { id: ItemKey; changes: Partial<Pick<ShownItem, "schedule" | "areaId" | "status" | "completedAt">> };

const DAY_GUIDE: GuideTopic[] = ["capture", "score"];

const MODES: { mode: DayViewMode; label: string }[] = [
  { mode: "score", label: "Score" },
  { mode: "list", label: "List" },
];

/** "Thursday 15 October", with the weekday a step quieter so the date leads. */
function DayHeading({ date }: { date: DayData["date"] }) {
  const text = formatDayHeading(date);
  const gap = text.indexOf(" ");
  return (
    <time dateTime={date}>
      {gap > 0 ? (
        <>
          <span className="text-ink-2">{text.slice(0, gap)}</span>
          {text.slice(gap)}
        </>
      ) : (
        text
      )}
    </time>
  );
}

function useNow(nowIso: string, ticking: boolean) {
  const [now, setNow] = useState(() => new Date(nowIso));
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [ticking]);
  return now;
}

export function DayView({
  data,
  mode,
  nav,
  detail,
  leftover,
  focus: focusSaved = false,
  tour = false,
  actions = serverActions,
}: {
  data: DayData;
  mode: DayViewMode;
  nav?: ReactNode;
  detail?: ReactNode;
  /** What is still open from earlier days. Today's page passes it; no other day does. */
  leftover?: LeftoverData | null;
  /** Focus, as this device last left it: today shows only Next up and folds the rest away. */
  focus?: boolean;
  /** Show the getting-started tour: a new account, or the Guide asked for it again. */
  tour?: boolean;
  actions?: DayActions;
}) {
  const { date, timeZone, areas, isToday, childCounts } = data;
  const router = useRouter();
  const clock = useClock();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
  const shownMode = mode;
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<Status | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const now = useNow(data.nowIso, isToday);

  const saved = useMemo(() => [...data.view.scheduled, ...data.view.waiting].map((e) => e.item), [data.view]);
  const [items, patch] = useOptimistic(saved, (current: ShownItem[], p: Patch) =>
    current.map((i) => (i.id === p.id ? { ...i, ...p.changes } : i)),
  );
  const range = useMemo(() => dayRangeFor(date, timeZone), [date, timeZone]);
  const view = useMemo(
    () =>
      buildToday(
        {
          scheduled: items.filter((i) => i.schedule.kind !== "unscheduled"),
          unscheduled: items.filter((i) => i.schedule.kind === "unscheduled"),
        },
        range,
        now,
      ),
    [items, range, now],
  );
  const nowMinutes = isToday ? localMinutes(now, date, timeZone) : null;
  const firstDay = data.firstDay && items.length === 0;
  const today = toLocalDate(now, timeZone);
  const glance = useMemo(() => dayGlance(view, date, today, now), [view, date, today, now]);
  const [focusOn, setFocus] = useState(focusSaved);
  const focus = focusOn && isToday && !firstDay;

  // A ticked item keeps its place for a moment, so the tick is seen, then folds in with the rest that are done.
  useEffect(() => {
    if (!justDone) return;
    const id = window.setTimeout(() => setJustDone(null), 4000);
    return () => window.clearTimeout(id);
  }, [justDone]);

  function toggleFocus() {
    const next = !focusOn;
    setFocus(next);
    document.cookie = `${FOCUS_COOKIE}=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
  }
  const areaName = (id: string | null | undefined) => areas.find((a) => a.id === id)?.name ?? "No area";

  function replaceParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function select(id: string | null) {
    startTransition(() => {
      setSelectedId(id);
      replaceParam(SELECTED_ITEM_PARAM, id);
    });
  }

  function switchMode(next: DayViewMode) {
    if (next === shownMode) return;
    startTransition(() => {
      replaceParam(DAY_VIEW_PARAM, next === "score" ? null : next);
    });
  }

  function describe(item: ShownItem, placement: Placement) {
    const s = placement.schedule;
    if (s.kind === "unscheduled") return `${item.title} is in the Inbox, with no day.`;
    if (s.kind === "day") return `${item.title} is on this day, at any time.`;
    const area = areaName(placement.areaId === undefined ? item.areaId : placement.areaId);
    return `${item.title}, ${formatClock(s.start, timeZone, clock)} to ${formatClock(s.end, timeZone, clock)}, ${area}.`;
  }

  function place(item: ShownItem, placement: Placement) {
    setStatus(null);
    const { schedule, areaId } = placement;
    startTransition(async () => {
      patch({ id: item.id, changes: areaId === undefined ? { schedule } : { schedule, areaId } });
      const result = await reach(actions.place(item.id, placement));
      const offer = seriesTimeOffer(item, placement, date, timeZone, data.cadences) ?? undefined;
      setStatus(result.ok ? { text: describe(item, placement), error: false, offer } : { text: result.error, error: true });
    });
  }

  function timeSeries(offer: SeriesTimeOffer) {
    setStatus(null);
    const at = formatClock(instantAt(date, offer.time.start, timeZone), timeZone, clock);
    startTransition(async () => {
      const result = await reach(actions.timeSeries(offer.id, offer.time));
      setStatus(
        result.ok ? { text: `${offer.title} is at ${at} ${offer.cadence}.`, error: false } : { text: result.error, error: true },
      );
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

  const shared = {
    view,
    today,
    waitingFull: data.waitingFull,
    areas,
    timeZone,
    childCounts,
    tags: data.tags,
    selectedId: selectedIn(items, selectedId),
    justDone,
    onSelect: select,
    onToggleDone: toggleDone,
  };

  /** The day itself, then what is left over from earlier days: today's plan comes before yesterday's. */
  const rest = () => (
    <>
      {shownMode === "score" ? (
        <ScoreView {...shared} date={date} nowMinutes={nowMinutes} firstDay={firstDay} onPlace={place} />
      ) : (
        <ListView {...shared} />
      )}
      {isToday && leftover && (
        <div className="mt-7">
          <LeftoverStrip data={leftover} onSelect={select} onStatus={(text, error) => setStatus({ text, error })} />
        </div>
      )}
    </>
  );

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="@container/page min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <header className="page-head">
          {/* A server element can arrive late as a lazy chunk, which React then checks for a key among its siblings. */}
          <Fragment key="nav">{nav}</Fragment>
          <div className="min-w-0">
            <h1 className="headline">
              <DayHeading date={date} />
            </h1>
            <GlanceLine glance={glance} timeZone={timeZone} />
          </div>
        </header>

        <div className="mt-6 mb-3 flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-[1_1_280px] rail:max-w-[440px]">
            <CaptureField
              captureAction={actions.capture}
              firstDay={firstDay}
              screenStatus={
                <p role="status" className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
                  {status?.text}
                  {status?.offer && " "}
                  {status?.offer && (
                    <button
                      type="button"
                      onClick={() => timeSeries(status.offer!)}
                      className="-mx-1 rounded px-1 font-medium text-ink underline decoration-rule underline-offset-2 hover:bg-hover active:bg-press hover:decoration-ink"
                    >
                      Same time {status.offer.cadence}
                    </button>
                  )}
                </p>
              }
            />
          </div>
          <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-lg border border-rule">
            {MODES.map(({ mode: m, label }) => (
              <button
                key={m}
                type="button"
                aria-pressed={shownMode === m}
                onClick={() => switchMode(m)}
                className={`px-3.5 py-2 font-medium pointer-coarse:py-3 ${shownMode === m ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {isToday && !firstDay && (
            <button
              type="button"
              aria-pressed={focusOn}
              onClick={toggleFocus}
              title="Show only what is next and what is due today"
              className={`rounded-lg border border-rule px-3.5 py-2 font-medium pointer-coarse:py-3 ${focusOn ? "border-ink bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"}`}
            >
              Focus
            </button>
          )}
          <GuideButton topics={DAY_GUIDE} className="ml-auto" />
        </div>

        {isToday && tour && <Tour />}

        {isToday && !firstDay && (
          <NextUp
            entries={focus ? glance.focus : glance.next}
            date={date}
            timeZone={timeZone}
            areas={areas}
            justDone={justDone}
            onSelect={select}
            onToggleDone={toggleDone}
          />
        )}

        {focus ? (
          <details className="group border-y border-rule">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none">
                <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              The whole day
              <span className="font-normal text-ink-3">{foldedWords(glance, leftover?.total ?? 0)}</span>
            </summary>
            <div className="pt-3 pb-4">{rest()}</div>
          </details>
        ) : (
          rest()
        )}
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}
