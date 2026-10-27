"use client";

import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";
import Link from "next/link";
import type { ReactNode } from "react";
import { AreaLabel, AreaMark } from "@/components/area-mark";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { setDoneAction } from "@/features/today/actions";
import { DoneToggle, useDoneToggles, type SetDone } from "@/features/today/done-toggle";
import { Glyph } from "@/features/today/glyph";
import { RepeatMark } from "@/features/today/repeat-mark";
import type { TaggedData } from "./commands";
import { tagLine, taggedSummary, TAGS_PATH } from "./model";

/** One tag's page: everything carrying it, open first. A row opens the detail panel beside the list. */
export function TaggedView({
  data,
  detail,
  indexHref = TAGS_PATH,
  setDone = setDoneAction,
}: {
  data: TaggedData;
  detail?: ReactNode;
  indexHref?: string;
  /** Defaults to the server action; the dev harness passes an in-memory one. */
  setDone?: SetDone;
}) {
  const { selectedParam, selectedId, select } = useItemSelection();
  const quick = useQuick();
  const ticks = useDoneToggles(setDone);

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <Link href={indexHref} className="-ml-2 rounded-md px-2 py-1 text-[13px] text-ink-2 hover:bg-hover active:bg-press hover:text-ink">
          All tags
        </Link>
        <h1 className="mt-2 headline break-words">
          <AreaMark color={data.tag.color} size={14} className="mr-3 align-[0.12em]" />
          <span aria-hidden="true" className="text-ink-3">
            #
          </span>
          {data.tag.name}
        </h1>
        <p className="page-summary">{taggedSummary(data.rows)}</p>
        <p role="status" className={`mt-4 min-h-5 text-[13px] ${ticks.status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {ticks.status?.text}
        </p>

        {data.rows.length > 0 && (
          <ul className="mt-2 max-w-[760px] border-t border-rule">
            {data.rows.map((row) => {
              const patch = quick?.patched(row.id);
              if (patch?.hidden) return null;
              const title = patch?.title ?? row.title;
              const qi = { ...row.quick, title };
              const tickable = !(row.repeats || row.type === "note");
              const hooks = {
                onOpen: () => select(row.id),
                onToggleDone: tickable ? () => ticks.toggle(row.id, title, !ticks.isDone(row.id, row.done)) : undefined,
                doneBox: tickable,
                inlineRename: "tagged",
              };
              const selected = selectedId === row.id;
              const done = ticks.isDone(row.id, row.done);
              const others = tagLine(row.tags);
              const meta = [row.when, row.area, others.shown].filter(Boolean);
              return (
                <li
                  key={row.id}
                  {...rowProps(quick, qi, hooks)}
                  className={`group/row relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) pointer-coarse:grid-cols-[48px_minmax(0,1fr)_auto] ${
                    selected ? "row-selected" : ""
                  }`}
                >
                  {/* A series is ticked one day at a time, on that day, and a note is never done. */}
                  {row.repeats || row.type === "note" ? (
                    <span className="grid h-6 place-items-center">
                      <Glyph type={row.type} state={done ? "done" : "planned"} />
                    </span>
                  ) : (
                    <span className="-my-1 grid place-items-center">
                      <DoneToggle
                        type={row.type}
                        title={title}
                        done={done}
                        justDone={ticks.justDone === row.id}
                        onToggle={() => ticks.toggle(row.id, row.title, !done)}
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    {quick?.renaming === renameKey("tagged", row.id) ? (
                      <RenameField item={qi} className="font-medium" />
                    ) : (
                    <button
                      type="button"
                      data-quick-focus
                      aria-pressed={selected}
                      onClick={() => select(row.id)}
                      className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${
                        done ? "font-normal text-ink-3" : "font-medium text-ink"
                      }`}
                    >
                      {title}
                      {row.repeats && (
                        <>
                          <RepeatMark className="ml-1.5 text-ink-3" />
                          <span className="sr-only">, repeats</span>
                        </>
                      )}
                      {done && <span className="sr-only">, done</span>}
                    </button>
                    )}
                    {meta.length > 0 && (
                      <p className={`mt-0.5 flex flex-wrap gap-x-2 text-xs ${selected ? "text-ink-2" : "text-ink-3"}`}>
                        {row.when && <span className="tabular">{row.when}</span>}
                        {row.area && <AreaLabel name={row.area} color={row.areaColor} />}
                        {others.shown && (
                          <span>
                            <span aria-hidden="true">{others.shown}</span>
                            <span className="sr-only">also {others.spoken}</span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <RowActions item={qi} hooks={hooks} className="quick-over" />
                </li>
              );
            })}
          </ul>
        )}
        {data.full && (
          <p className="mt-3 text-[13px] text-ink-3">Showing the first {data.rows.length}. Older done items may not be listed.</p>
        )}
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}
