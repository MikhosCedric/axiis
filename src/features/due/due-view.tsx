"use client";

import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";
import type { ReactNode } from "react";
import { AreaLabel } from "@/components/area-mark";
import { place } from "@/components/shell/places";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { setDoneAction } from "@/features/today/actions";
import { DoneToggle, useDoneToggles, type SetDone } from "@/features/today/done-toggle";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopePrefix, type ViewFilter } from "@/features/filter/model";
import type { LocalDate } from "@/domain/item";
import { shortPlanned } from "@/features/day/leftover-model";
import { dueChip, dueSummary, GROUP_LABEL, inGroup, type DueData, type DueGroup, type DueRow, type DueTone } from "./model";

const GROUPS: DueGroup[] = ["past", "week", "later"];

/** Everything with a due date, soonest first, in three groups. A row opens the detail panel, where the date is changed or cleared. */
export function DueView({
  data,
  detail,
  filter = NO_FILTER,
  setDone = setDoneAction,
}: {
  data: DueData;
  detail?: ReactNode;
  /** What the page narrowed its rows to; the rows passed in are already narrowed. */
  filter?: ViewFilter;
  /** Defaults to the server action; the dev harness passes an in-memory one. */
  setDone?: SetDone;
}) {
  const { selectedParam, selectedId, select } = useItemSelection();
  const ticks = useDoneToggles(setDone);

  const rows = data.rows.map((r) => ({ ...r, done: ticks.isDone(r.id, r.done) }));

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="mx-auto w-full max-w-[880px] min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <h1 className="headline">Due</h1>
        <p className="page-summary">
          {place("due").hint}. {scopePrefix(filter)}
          {dueSummary(rows)}
        </p>
        <FilterChips filter={filter} className="mt-2.5" />
        <p role="status" className={`mt-4 min-h-5 text-[13px] ${ticks.status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {ticks.status?.text}
        </p>

        {rows.length === 0 ? (
          <p className="mt-2 max-w-[52ch] text-ink-2">
            A due date is a deadline, kept apart from the day you plan to do the thing. Set one from an item&rsquo;s
            details and it shows up here, soonest first.
          </p>
        ) : (
          GROUPS.map((group) => {
            const inThis = inGroup(rows, group);
            if (inThis.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`due-${group}`} className="mt-6">
                <h2 id={`due-${group}`} className="mb-2 font-display text-lg leading-[1.25] font-medium">
                  {GROUP_LABEL[group]}
                </h2>
                <ul className="surface overflow-hidden px-3 py-1.5 [&_li:last-child]:border-b-0">
                  {inThis.map((row) => (
                    <DueRowView
                      key={row.id}
                      row={row}
                      today={data.today}
                      selected={selectedId === row.id}
                      justDone={ticks.justDone === row.id}
                      onSelect={() => select(row.id)}
                      onToggleDone={() => ticks.toggle(row.id, row.title, !row.done)}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
        {data.full && (
          <p className="mt-3 text-[13px] text-ink-3">Showing the first {data.rows.length}. Later due dates may not be listed.</p>
        )}
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

const CHIP_TONE: Record<DueTone, string> = {
  past: "border border-ink-2 text-ink",
  soon: "bg-hover text-ink",
  far: "text-ink-2",
  done: "text-ink-3",
};

/** The due date as a small chip: outlined once it is behind us, filled inside the week, plain beyond it. */
function DueChip({ row, today }: { row: DueRow; today: LocalDate }) {
  const { text, tone } = dueChip(row.dueOn, today, row.done);
  return (
    <span aria-hidden="true" className={`inline-flex items-center rounded-full px-2 py-px font-medium tabular ${CHIP_TONE[tone]}`}>
      {text}
    </span>
  );
}

function DueRowView({
  row,
  today,
  selected,
  justDone,
  onSelect,
  onToggleDone,
}: {
  row: DueRow;
  today: LocalDate;
  selected: boolean;
  justDone: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const quick = useQuick();
  const patch = quick?.patched(row.id);
  const title = patch?.title ?? row.title;
  const qi = { ...row.quick, title };
  const hooks = { onOpen: onSelect, onToggleDone, inlineRename: "due", doneBox: true, swipe: true };
  // The quietest ink is too faint to read on the accent wash of a selected row.
  const quiet = selected ? "text-ink-2" : "text-ink-3";
  if (patch?.hidden) return null;
  return (
    <li
      {...rowProps(quick, qi, hooks)}
      className={`group/row relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[48px_minmax(0,1fr)_auto] ${selected ? "row-selected" : ""}`}
    >
      <span className="-my-1 grid place-items-center">
        <DoneToggle type={row.type} title={title} done={row.done} justDone={justDone} onToggle={onToggleDone} />
      </span>
      <div className="min-w-0">
        {quick?.renaming === renameKey("due", row.id) ? (
          <RenameField item={qi} className="font-medium" />
        ) : (
        <button
          type="button"
          data-quick-focus
          aria-pressed={selected}
          onClick={onSelect}
          className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${row.done ? `font-normal ${quiet}` : "font-medium text-ink"}`}
        >
          {title}
          {row.done && <span className="sr-only">, done</span>}
        </button>
        )}
        <p className={`mt-0.5 flex flex-wrap gap-x-3 text-xs ${quiet}`}>
          <span className="sr-only">{row.due}</span>
          <DueChip row={row} today={today} />
          {row.when && (
            <span className="tabular">
              <span className="sr-only">Planned {row.when}</span>
              <span aria-hidden="true">Planned {shortPlanned(`Planned ${row.when}`)}</span>
            </span>
          )}
          {row.area && <AreaLabel name={row.area} color={row.areaColor} />}
        </p>
      </div>
      <RowActions item={qi} hooks={hooks} className="quick-over" />
    </li>
  );
}
