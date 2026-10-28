"use client";

import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";
import { useId, type ReactNode } from "react";
import { AreaLabel } from "@/components/area-mark";
import { ProgressLine } from "@/components/progress-line";
import { place } from "@/components/shell/places";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { CaptureField } from "@/features/today/capture-field";
import type { CaptureResult } from "@/features/today/commands";
import { setDoneAction } from "@/features/today/actions";
import { DoneToggle, useDoneToggles, type SetDone } from "@/features/today/done-toggle";
import { Glyph } from "@/features/today/glyph";
import { RepeatMark } from "@/features/today/repeat-mark";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopePrefix, type ViewFilter } from "@/features/filter/model";
import { captureChecklistAction } from "./actions";
import { listsSummary, progressShare, progressWords, type ListRow, type ListsData } from "./model";

/** Every checklist, open first, with how far along each is. A row opens the detail panel, where its lines live. */
export function ListsView({
  data,
  detail,
  filter = NO_FILTER,
  capture = captureChecklistAction,
  setDone = setDoneAction,
}: {
  data: ListsData;
  detail?: ReactNode;
  /** What the page narrowed its rows to; the rows passed in are already narrowed. */
  filter?: ViewFilter;
  /** Defaults to the server actions; the dev harness passes in-memory ones. */
  capture?: (title: string) => Promise<CaptureResult>;
  setDone?: SetDone;
}) {
  const { selectedParam, selectedId, select } = useItemSelection();
  const ticks = useDoneToggles(setDone);

  // A new checklist opens beside the list at once, since its lines are the next thing to write.
  async function captureAndOpen(title: string): Promise<CaptureResult> {
    const result = await capture(title);
    if (result.ok) select(result.id);
    return result;
  }

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <h1 className="headline">Lists</h1>
        <p className="page-summary">
          {place("lists").hint}. {scopePrefix(filter)}
          {listsSummary(data.rows)}
        </p>
        <FilterChips filter={filter} className="mt-2.5" />

        <div className="mt-6 mb-3">
          <CaptureField
            captureAction={captureAndOpen}
            label="New checklist"
            placeholder="Name a checklist, then add its lines"
            plans={false}
            screenStatus={
              <p role="status" className={ticks.status?.error ? "font-medium text-ink" : "text-ink-2"}>
                {ticks.status?.text}
              </p>
            }
          />
        </div>

        {data.rows.length > 0 ? (
          <ul className="surface overflow-hidden px-3 [&_li:last-child]:border-b-0 mt-2 max-w-[760px]">
            {data.rows.map((row) => {
              const done = ticks.isDone(row.id, row.done);
              return (
                <ListRowView
                  key={row.id}
                  row={{ ...row, done }}
                  selected={selectedId === row.id}
                  justDone={ticks.justDone === row.id}
                  onSelect={() => select(row.id)}
                  onToggleDone={() => ticks.toggle(row.id, row.title, !done)}
                />
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 max-w-[52ch] text-ink-2">
            A checklist keeps the small steps of one thing together, like packing or a move. Name one above and its lines
            go in beside it.
          </p>
        )}
        {data.full && (
          <p className="mt-3 text-[13px] text-ink-3">Showing the first {data.rows.length}. Older done checklists may not be listed.</p>
        )}
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

function ListRowView({
  row,
  selected,
  justDone,
  onSelect,
  onToggleDone,
}: {
  row: ListRow;
  selected: boolean;
  justDone: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const metaId = useId();
  const quick = useQuick();
  const patch = quick?.patched(row.id);
  const title = patch?.title ?? row.title;
  const qi = { ...row.quick, title };
  const hooks = { onOpen: onSelect, onToggleDone: row.repeats ? undefined : onToggleDone, doneBox: !row.repeats, inlineRename: "lists", swipe: true };
  // The quietest ink is too faint to read on the accent wash of a selected row.
  const quiet = selected ? "text-ink-2" : "text-ink-3";
  if (patch?.hidden) return null;
  return (
    <li
      {...rowProps(quick, qi, hooks)}
      className={`group/row relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[48px_minmax(0,1fr)_auto] ${selected ? "row-selected" : ""}`}
    >
      {/* A repeating checklist is ticked one day at a time, on that day. */}
      {row.repeats ? (
        <span className="grid h-6 place-items-center">
          <Glyph type="checklist" state={row.done ? "done" : "planned"} />
        </span>
      ) : (
        <span className="-my-1 grid place-items-center">
          <DoneToggle type="checklist" title={title} done={row.done} justDone={justDone} onToggle={onToggleDone} />
        </span>
      )}
      <div className="min-w-0">
        {quick?.renaming === renameKey("lists", row.id) ? (
          <RenameField item={qi} className="font-medium" />
        ) : (
        <button
          type="button"
          data-quick-focus
          aria-pressed={selected}
          aria-describedby={metaId}
          onClick={onSelect}
          className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${row.done ? `font-normal ${quiet}` : "font-medium text-ink"}`}
        >
          {title}
          {row.repeats && (
            <>
              <RepeatMark className={`ml-1.5 ${quiet}`} />
              <span className="sr-only">, repeats</span>
            </>
          )}
          {row.done && <span className="sr-only">, done</span>}
        </button>
        )}
        <p id={metaId} className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${quiet}`}>
          {row.progress && (
            <span className="flex items-center gap-2">
              <ProgressLine share={progressShare(row.progress)} />
              <span className="tabular">{progressWords(row.progress)}</span>
            </span>
          )}
          {row.when && <span className="tabular">{row.when}</span>}
          {row.area && <AreaLabel name={row.area} color={row.areaColor} />}
        </p>
      </div>
      <RowActions item={qi} hooks={hooks} className="quick-over" />
    </li>
  );
}
