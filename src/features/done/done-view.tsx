"use client";

import { PageHeader } from "@/components/shell/page-header";
import { GuideButton, NO_TOPICS } from "@/features/palette/guide";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { AreaLabel } from "@/components/area-mark";
import { place } from "@/components/shell/places";
import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopePrefix, type ViewFilter } from "@/features/filter/model";
import { RowTags } from "@/features/tags/row-tags";
import { setDoneAction } from "@/features/today/actions";
import { DoneToggle, useDoneToggles, type SetDone } from "@/features/today/done-toggle";
import { dayCount, DONE_PAGE_PARAM, doneSummary, groupByDay, type DoneData, type DoneRow } from "./model";

/**
 * What was finished, newest day first, one section per day. A row is the ordinary row: opening it shows
 * its details, and unticking it makes it open again. Nothing is scored or totalled; a day says how many.
 */
export function DoneView({
  data,
  detail,
  filter = NO_FILTER,
  setDone = setDoneAction,
}: {
  data: DoneData;
  detail?: ReactNode;
  /** What the page narrowed its rows to; the rows passed in are already narrowed. */
  filter?: ViewFilter;
  /** Defaults to the server action; the dev harness passes an in-memory one. */
  setDone?: SetDone;
}) {
  const { selectedParam, selectedId, select } = useItemSelection();
  const ticks = useDoneToggles(setDone);
  const days = groupByDay(data.rows, data.today);

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="mx-auto w-full max-w-[880px] min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <PageHeader heading={<h1 className="headline">Done</h1>} controls={<GuideButton topics={NO_TOPICS} />}>
          <p className="page-summary">
            {place("done").hint}. {scopePrefix(filter)}
            {doneSummary(data.rows.length, data.more)}
          </p>
          <FilterChips filter={filter} className="mt-2.5" />
        </PageHeader>
        <p role="status" className={`mt-4 min-h-5 text-[13px] ${ticks.status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {ticks.status?.text}
        </p>

        {data.rows.length === 0 ? (
          <p className="mt-2 max-w-[52ch] text-ink-2">
            {data.more
              ? "Nothing in this view among the latest items. Show earlier ones to look further back."
              : "Tick a task or a list off and it is kept here, under the day you finished it. Unticking it brings it back."}
          </p>
        ) : (
          days.map((day) => (
            <section key={day.date} aria-labelledby={`done-${day.date}`} className="done-day mt-6">
              <h2 id={`done-${day.date}`} className="mb-2 flex items-baseline gap-3 font-display text-lg leading-[1.25] font-medium">
                {day.heading}
                <span className="text-[13px] font-normal text-ink-3 tabular">{dayCount(day.rows.length)}</span>
              </h2>
              <ul className="surface overflow-hidden px-3 py-1.5 [&_li:last-child]:border-b-0">
                {day.rows.map((row) => (
                  <DoneRowView
                    key={row.id}
                    row={row}
                    done={ticks.isDone(row.id, true)}
                    selected={selectedId === row.id}
                    justDone={ticks.justDone === row.id}
                    onSelect={() => select(row.id)}
                    onToggleDone={() => ticks.toggle(row.id, row.title, !ticks.isDone(row.id, true))}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
        {data.more && <ShowEarlier pages={data.pages} />}
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

/** The same page with one more page of earlier items; every other part of the address stays. */
function ShowEarlier({ pages }: { pages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.set(DONE_PAGE_PARAM, String(pages + 1));
  return (
    <p className="mt-5 print:hidden">
      <Link href={`${pathname}?${next.toString()}`} scroll={false} className="pill h-9 px-3">
        Show earlier
      </Link>
    </p>
  );
}

function DoneRowView({
  row,
  done,
  selected,
  justDone,
  onSelect,
  onToggleDone,
}: {
  row: DoneRow;
  done: boolean;
  selected: boolean;
  justDone: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const quick = useQuick();
  const patch = quick?.patched(row.id);
  const title = patch?.title ?? row.title;
  const qi = { ...row.quick, title, done };
  const hooks = { onOpen: onSelect, onToggleDone, inlineRename: "done", doneBox: true, swipe: true };
  const quiet = selected ? "text-ink-2" : "text-ink-3";
  if (patch?.hidden) return null;
  return (
    <li
      {...rowProps(quick, qi, hooks)}
      className={`group/row relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[48px_minmax(0,1fr)_auto] ${selected ? "row-selected" : ""}`}
    >
      <span className="-my-1 grid place-items-center">
        <DoneToggle type={row.type} title={title} done={done} justDone={justDone} onToggle={onToggleDone} />
      </span>
      <div className="min-w-0">
        {quick?.renaming === renameKey("done", row.id) ? (
          <RenameField item={qi} className="font-medium" />
        ) : (
          <button
            type="button"
            data-quick-focus
            aria-pressed={selected}
            onClick={onSelect}
            className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${done ? `font-normal ${quiet}` : "font-medium text-ink"}`}
          >
            {title}
            {done && <span className="sr-only">, done</span>}
            <RowTags tags={row.tags} selected={selected} />
          </button>
        )}
        {row.area && (
          <p className={`mt-0.5 flex flex-wrap gap-x-3 text-xs ${quiet}`}>
            <AreaLabel name={row.area} color={row.areaColor} />
          </p>
        )}
      </div>
      <RowActions item={qi} hooks={hooks} className="quick-over" />
    </li>
  );
}
