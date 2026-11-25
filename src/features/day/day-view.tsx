"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Segmented } from "@/components/segmented";
import { CalendarBar } from "@/components/shell/calendar-bar";
import { useClock } from "@/components/shell/clock-context";
import { FOCUS_COOKIE } from "@/components/shell/cookies";
import { PageHeader } from "@/components/shell/page-header";
import { TitleBar } from "@/components/shell/title-bar";
import type { ShownItem } from "@/domain/item";
import type { GridExample } from "@/features/calendar/calendar-grid";
import { CalendarView, type CalendarActions, type CalendarContext, type PlaceOffer } from "@/features/calendar/calendar-view";
import type { Placement } from "@/features/calendar/grid-drop";
import { dayCalendar } from "@/features/calendar/load";
import { setTimeAction } from "@/features/detail/actions";
import type { TimeOfDay } from "@/features/detail/model";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopeWords, type ViewFilter } from "@/features/filter/model";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { placeAction } from "@/features/score/actions";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { CaptureField, type PasteActions } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { formatDayHeading } from "@/features/today/format";
import { buildToday } from "@/features/today/model";
import { formatClock } from "@/lib/clock";
import { dayRangeFor, instantAt } from "@/lib/dates";
import { exampleBlocks } from "./first-day";
import { dayGlance } from "./glance";
import { ProgressLine } from "@/components/progress-line";
import type { DueSoonData } from "./due-soon";
import { DueSoonStrip } from "./due-soon-strip";
import type { LeftoverData } from "./leftover-model";
import { LeftoverStrip } from "./leftover-strip";
import { ListView } from "./list-view";
import { GlanceLine, NextUp } from "./next-up";
import { PLAN_DAY_SHOWN, PlanDayStrip } from "./plan-day-strip";
import { RestOfDay } from "./rest-button";
import { restOfDay } from "./rest-of-day";
import { seriesTimeOffer } from "./series-time";
import { Tour } from "./tour";
import { DAY_VIEW_PARAM, type DayData, type DayViewMode } from "./types";

/** The writes the day makes. Defaults to the server actions; a dev harness passes in-memory ones. */
export type DayActions = CalendarActions & {
  /** What a pasted block may become; the app's own when the capture is the app's own. */
  paste?: PasteActions;
  /** Gives the whole series an occurrence belongs to this time of day. */
  timeSeries: (id: string, time: TimeOfDay) => Promise<ActionResult>;
};

const serverActions: DayActions = {
  place: placeAction,
  setDone: setDoneAction,
  capture: captureAction,
  timeSeries: (id, time) => setTimeAction(id, time, "all"),
};

const DAY_GUIDE: GuideTopic[] = ["capture", "grid"];

const MODES: { mode: DayViewMode; label: string }[] = [
  { mode: "grid", label: "Grid" },
  { mode: "list", label: "List" },
];

/**
 * A day: the calendar bar and capture, the at-a-glance line, then the day as one column of the time grid
 * (or as a list), with Next up, what is left over from earlier days beside it on today.
 * Focus dims everything on the grid but what is happening now, and leaves only Next up beside it.
 */
export function DayView({
  data,
  mode,
  detail,
  leftover,
  dueSoon,
  focus: focusSaved = false,
  tour = false,
  filter = NO_FILTER,
  actions = serverActions,
}: {
  data: DayData;
  mode: DayViewMode;
  detail?: ReactNode;
  /** What is still open from earlier days. Today's page passes it; no other day does. */
  leftover?: LeftoverData | null;
  /** The next few due dates, beside the day on wide screens. Today's page passes it. */
  dueSoon?: DueSoonData | null;
  /** Focus, as this device last left it. */
  focus?: boolean;
  /** Show the getting-started tour: a new account, or the Guide asked for it again. */
  tour?: boolean;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
  actions?: DayActions;
}) {
  const { date, timeZone, areas, isToday } = data;
  const clock = useClock();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const calendar = useMemo(() => dayCalendar(data), [data]);
  const firstDay = data.firstDay && data.view.scheduled.length + data.view.waiting.length === 0;
  const [focusOn, setFocus] = useState(focusSaved);
  // Where the grid draws its Inbox: in the side column, once that has mounted.
  const [trayHost, setTrayHost] = useState<HTMLElement | null>(null);
  const focus = focusOn && isToday && !firstDay;
  const examples = useMemo<GridExample[]>(() => (firstDay ? exampleBlocks(areas) : []), [firstDay, areas]);

  function toggleFocus() {
    const next = !focusOn;
    setFocus(next);
    document.cookie = `${FOCUS_COOKIE}=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
  }

  function switchMode(next: DayViewMode) {
    if (next === mode) return;
    const query = new URLSearchParams(params.toString());
    if (next === "grid") query.delete(DAY_VIEW_PARAM);
    else query.set(DAY_VIEW_PARAM, next);
    const search = query.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  }

  /** After one occurrence of a series got a new time: the offer to give the whole series that time. */
  function offer(item: ShownItem, placement: Placement): PlaceOffer | null {
    const o = seriesTimeOffer(item, placement, date, timeZone, data.cadences);
    if (!o) return null;
    const at = formatClock(instantAt(date, o.time.start, timeZone), timeZone, clock);
    return { label: `Same time ${o.cadence}`, run: () => actions.timeSeries(o.id, o.time), said: `${o.title} is at ${at} ${o.cadence}.` };
  }

  return (
    <CalendarView
      data={calendar}
      days={[date]}
      mode="day"
      detail={detail}
      dim={focus}
      actions={actions}
      examples={examples}
      offer={offer}
      trayHost={mode === "grid" ? trayHost : undefined}
      className="@container/page mx-auto w-full max-w-[1176px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8 rail:pb-4"
    >
      {(ctx, grid) => (
        <DayPage
          ctx={ctx}
          grid={grid}
          data={data}
          mode={mode}
          leftover={leftover ?? null}
          dueSoon={dueSoon ?? null}
          trayRef={setTrayHost}
          focus={focus}
          firstDay={firstDay}
          tour={tour}
          filter={filter}
          capture={actions.capture}
          paste={actions.paste}
          controls={
            <>
              <Segmented
                label="View"
                chosen={mode}
                segments={MODES.map(({ mode: key, label }) => ({ key, label }))}
                onChoose={(m) => switchMode(m as DayViewMode)}
                className="h-[38px] pointer-coarse:h-12"
              />
              {isToday && !firstDay && (
                <button
                  type="button"
                  aria-pressed={focusOn}
                  onClick={toggleFocus}
                  title="Dim everything but what is happening now, and show only what is next"
                  className={`press rounded-lg border border-rule px-3.5 py-2 font-medium pointer-coarse:py-3 ${focusOn ? "border-ink bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"}`}
                >
                  Focus
                </button>
              )}
              <GuideButton topics={DAY_GUIDE} />
            </>
          }
        />
      )}
    </CalendarView>
  );
}

/** The day laid out around its grid. A component of its own, so what it works out from the items is kept between renders. */
function DayPage({
  ctx,
  grid,
  data,
  mode,
  leftover,
  dueSoon,
  trayRef,
  focus,
  firstDay,
  tour,
  filter,
  capture,
  paste,
  controls,
}: {
  ctx: CalendarContext;
  grid: ReactNode;
  data: DayData;
  mode: DayViewMode;
  leftover: LeftoverData | null;
  dueSoon: DueSoonData | null;
  trayRef: (el: HTMLElement | null) => void;
  focus: boolean;
  firstDay: boolean;
  tour: boolean;
  filter: ViewFilter;
  capture: DayActions["capture"];
  paste: DayActions["paste"];
  controls: ReactNode;
}) {
  const { date, timeZone, areas, isToday } = data;
  const { items, now, today } = ctx;
  const range = useMemo(() => dayRangeFor(date, timeZone), [date, timeZone]);
  const view = useMemo(
    () =>
      buildToday(
        { scheduled: items.filter((i) => i.schedule.kind !== "unscheduled"), unscheduled: items.filter((i) => i.schedule.kind === "unscheduled") },
        range,
        now,
      ),
    [items, range, now],
  );
  const glance = useMemo(() => dayGlance(view, date, today, now), [view, date, today, now]);

  // An empty today with things waiting in the Inbox gets a nudge to pull some in.
  const waitingOpen = view.waiting.filter((e) => e.item.status === "open");
  const nudge = isToday && !firstDay && !focus && view.scheduled.length === 0 && waitingOpen.length > 0;
  const entries = focus ? glance.focus : glance.next.slice(0, 1);

  const nextNode =
    isToday && !firstDay && entries.length > 0 ? (
      <NextUp entries={entries} date={date} timeZone={timeZone} areas={areas} justDone={ctx.justDone} onSelect={ctx.select} onToggleDone={ctx.toggleDone} />
    ) : null;
  const planNode = nudge ? (
    <PlanDayStrip
      rows={waitingOpen.slice(0, PLAN_DAY_SHOWN).map((e) => ({ id: e.item.id, type: e.item.type, title: e.item.title }))}
      total={waitingOpen.length}
      onSelect={ctx.select}
      onStatus={ctx.say}
    />
  ) : null;
  // Focus leaves only what is next beside the day: what is left over and the week come back with it off.
  const leftNode = isToday && leftover && !focus ? <LeftoverStrip data={leftover} onSelect={ctx.select} onStatus={ctx.say} /> : null;
  const dueNode = dueSoon && !firstDay && !focus ? <DueSoonStrip data={dueSoon} onSelect={ctx.select} /> : null;
  // The day's own progress, in the side column on wide screens (a narrow page keeps it under the summary).
  const progressNode =
    glance.total > 0 ? (
      <section aria-label="Progress" className="surface side-part px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-2">{date === today ? "Today" : formatDayHeading(date)}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">{glance.done} of {glance.total} done</p>
        <ProgressLine share={glance.done / glance.total} className="mt-2 w-full text-ink-2" />
      </section>
    ) : null;
  // The rest of today: open tasks still to do, offered for tomorrow while the day is going. Focus folds it away with the rest.
  const rest = useMemo(() => (isToday && !firstDay && !focus && mode === "grid" ? restOfDay(view.scheduled) : []), [isToday, firstDay, focus, mode, view]);
  const restNode = rest.length > 0 ? <RestOfDay items={rest} onStatus={ctx.say} /> : null;
  const hasSide = Boolean(restNode || nextNode || planNode || leftNode || dueNode || progressNode || mode === "grid");

  const dayNode =
    mode === "list" ? (
      <ListView
        view={view}
        today={today}
        waitingFull={data.waitingFull}
        areas={areas}
        timeZone={timeZone}
        childCounts={data.childCounts}
        tags={data.tags}
        selectedId={ctx.selectedId}
        justDone={ctx.justDone}
        onSelect={ctx.select}
        onToggleDone={ctx.toggleDone}
      />
    ) : (
      grid
    );

  return (
    <>
      <TitleBar heading="day-title">{formatDayHeading(date)}</TitleBar>
      <PageHeader
        heading={<CalendarBar span="day" date={date} today={today} mode={mode} titleId="day-title" />}
        controls={controls}
        bar
        inline={!firstDay}
        capture={<CaptureField inline={!firstDay} captureAction={capture} pasteActions={paste} firstDay={firstDay} screenStatus={ctx.status} />}
      >
        <GlanceLine glance={glance} scope={scopeWords(filter)} />
        <FilterChips filter={filter} className="mt-2.5" />
      </PageHeader>

      {isToday && tour && <Tour />}

      {/* Wide: the day takes the left, and what surrounds it (Next up, the plan, left-overs, the week) stacks on the right.
          Narrow: one column, in the order they read, the week left out, at most 720px and centred so no blank strip sits
          beside it. The side column comes beside the day as soon as both fit: the capped day, the gap and the side's
          least width (40 + 1.5 + 16 = 57.5rem). Beside the day, the side column is as tall as the grid and scrolls
          inside itself, its longer lists capped with a link to their page. It is positioned, so the screen-reader text
          in its cards (absolute, sr-only) is clipped with them rather than hanging below the window and scrolling the page. */}
      <div
        data-focus={focus ? "" : undefined}
        data-day-layout=""
        className={`mx-auto flex w-full max-w-[45rem] flex-col ${hasSide ? "@min-[57.5rem]/page:mx-0 @min-[57.5rem]/page:grid @min-[57.5rem]/page:max-w-none @min-[57.5rem]/page:grid-cols-[minmax(0,40rem)_minmax(16rem,1fr)] @min-[57.5rem]/page:grid-rows-[auto_1fr] @min-[57.5rem]/page:justify-start @min-[57.5rem]/page:gap-x-6" : ""}`}
      >
        {hasSide && (
          <div className="contents @min-[57.5rem]/page:surface @min-[57.5rem]/page:max-w-[27rem] @min-[57.5rem]/page:col-start-2 @min-[57.5rem]/page:row-start-1 @min-[57.5rem]/page:relative @min-[57.5rem]/page:block @min-[57.5rem]/page:max-h-[var(--calendar-fit,none)] @min-[57.5rem]/page:divide-y @min-[57.5rem]/page:divide-rule-soft @min-[57.5rem]/page:self-start @min-[57.5rem]/page:overflow-y-auto">
            {progressNode && <div className="order-[0] hidden @min-[57.5rem]/page:block">{progressNode}</div>}
            {nextNode && <div className="order-1">{nextNode}</div>}
            {planNode && <div className="order-2">{planNode}</div>}
            {/* The grid's Inbox: under the day on a narrow page, a card here on a wide one. */}
            {mode === "grid" && <div ref={trayRef} className="order-4 mt-6 empty:hidden @min-[57.5rem]/page:order-3 @min-[57.5rem]/page:mt-0" />}
            {leftNode && <div className="order-5 mt-7 @min-[57.5rem]/page:order-5 @min-[57.5rem]/page:mt-0">{leftNode}</div>}
            {/* Not a scroll anchor: it mounts after the page has scrolled to now, and must not nudge that. */}
            {restNode && <div className="order-5 mt-3 mb-3 [overflow-anchor:none] @min-[57.5rem]/page:mt-0 @min-[57.5rem]/page:px-4 @min-[57.5rem]/page:py-3">{restNode}</div>}
            {dueNode && <div className="order-6 hidden @min-[57.5rem]/page:block">{dueNode}</div>}
          </div>
        )}
        <div className="order-3 min-w-0 @min-[57.5rem]/page:col-start-1 @min-[57.5rem]/page:row-span-2 @min-[57.5rem]/page:row-start-1">{dayNode}</div>
      </div>
    </>
  );
}
