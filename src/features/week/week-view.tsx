"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarBar } from "@/components/shell/calendar-bar";
import { PageHeader } from "@/components/shell/page-header";
import { TitleBar } from "@/components/shell/title-bar";
import type { LocalDate } from "@/domain/item";
import { CalendarView, type CalendarActions, type CalendarContext, type CalendarData } from "@/features/calendar/calendar-view";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopeWords, type ViewFilter } from "@/features/filter/model";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { CaptureField } from "@/features/today/capture-field";
import { buildToday } from "@/features/today/model";
import { dayRangeFor } from "@/lib/dates";
import { useNarrow } from "@/lib/use-narrow";
import { bucketWeek, formatWeekHeading, narrowDays, weekSummary, WEEK_FULL } from "./model";

const WEEK_GUIDE: GuideTopic[] = ["capture", "grid", "week"];

/**
 * A week: the calendar bar and capture, where the week stands in a line, then its seven days as columns
 * of the time grid with the Inbox as a tray underneath. A narrow screen draws three days, from the day in
 * the address, and the bar steps three at a time (ADR-0004).
 */
export function WeekView({
  calendar,
  days,
  from,
  weekFull = false,
  detail,
  filter = NO_FILTER,
  actions,
}: {
  calendar: CalendarData;
  /** The seven days of the week. */
  days: LocalDate[];
  /** The day the address names (today on `/week`): where a narrow screen's three days begin. */
  from: LocalDate;
  /** The week's read hit its cap, so later items are not drawn. */
  weekFull?: boolean;
  detail?: ReactNode;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
  actions?: CalendarActions;
}) {
  const narrow = useNarrow();
  const three = useMemo(() => narrowDays(from), [from]);
  return (
    <CalendarView
      data={calendar}
      days={narrow ? three : days}
      mode={narrow ? "3day" : "week"}
      detail={detail}
      actions={actions}
      className="@container/page px-4 pt-6 pb-14 rail:px-9 rail:pt-8"
    >
      {(ctx, grid) => <WeekPage ctx={ctx} grid={grid} calendar={calendar} days={days} from={from} weekFull={weekFull} filter={filter} capture={actions?.capture} />}
    </CalendarView>
  );
}

function WeekPage({
  ctx,
  grid,
  calendar,
  days,
  from,
  weekFull,
  filter,
  capture,
}: {
  ctx: CalendarContext;
  grid: ReactNode;
  calendar: CalendarData;
  days: LocalDate[];
  from: LocalDate;
  weekFull: boolean;
  filter: ViewFilter;
  capture?: CalendarActions["capture"];
}) {
  const { timeZone } = calendar;
  const { items, now, today } = ctx;
  // The line speaks of the whole week, whichever of its days a narrow screen shows.
  const summary = useMemo(() => {
    const week = bucketWeek(items.filter((i) => i.schedule.kind !== "unscheduled"), days, timeZone, now);
    const inbox = buildToday(
      { scheduled: [], unscheduled: items.filter((i) => i.schedule.kind === "unscheduled" && i.parentId === null) },
      dayRangeFor(today, timeZone),
      now,
    ).waiting;
    return weekSummary(week, inbox, today, scopeWords(filter));
  }, [items, days, timeZone, now, today, filter]);

  return (
    <>
      <TitleBar heading="week-title">{formatWeekHeading(days)}</TitleBar>
      <PageHeader
        heading={<CalendarBar span="week" date={days[0]} from={from} today={today} titleId="week-title" />}
        controls={<GuideButton topics={WEEK_GUIDE} />}
        capture={<CaptureField captureAction={capture} screenStatus={ctx.status} />}
      >
        <p className="page-summary">{summary}</p>
        <FilterChips filter={filter} className="mt-2.5" />
      </PageHeader>
      {grid}
      {weekFull && <p className="mt-2 text-[13px] text-ink-3">{WEEK_FULL}</p>}
    </>
  );
}
