"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { DetailAside } from "@/features/detail/detail-aside";
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
  const [, startTransition] = useTransition();
  const ticks = useDoneToggles(setDone);

  function select(id: string) {
    startTransition(() => {
      setSelectedId(id);
      const next = new URLSearchParams(params.toString());
      next.set(SELECTED_ITEM_PARAM, id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <Link href={indexHref} className="-ml-2 rounded-md px-2 py-1 text-[13px] text-ink-2 hover:bg-hover active:bg-press hover:text-ink">
          All tags
        </Link>
        <h1 className="mt-2 headline break-words">
          <span aria-hidden="true" className="text-ink-3">
            #
          </span>
          {data.tag.name}
        </h1>
        <p className="mt-2.5 text-[15px] text-ink-2">{taggedSummary(data.rows)}</p>
        <p role="status" className={`mt-4 min-h-5 text-[13px] ${ticks.status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {ticks.status?.text}
        </p>

        {data.rows.length > 0 && (
          <ul className="mt-2 max-w-[760px] border-t border-rule">
            {data.rows.map((row) => {
              const selected = selectedId === row.id;
              const done = ticks.isDone(row.id, row.done);
              const others = tagLine(row.tags);
              const meta = [row.when, row.area, others.shown].filter(Boolean);
              return (
                <li
                  key={row.id}
                  className={`grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-(--row-y) ${
                    selected ? "bg-accent-wash" : ""
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
                        title={row.title}
                        done={done}
                        justDone={ticks.justDone === row.id}
                        onToggle={() => ticks.toggle(row.id, row.title, !done)}
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => select(row.id)}
                      className={`cursor-pointer rounded text-left tap-y break-words hover:underline ${
                        done ? "font-normal text-ink-3" : "font-medium text-ink"
                      }`}
                    >
                      {row.title}
                      {row.repeats && (
                        <>
                          <RepeatMark className="ml-1.5 text-ink-3" />
                          <span className="sr-only">, repeats</span>
                        </>
                      )}
                      {done && <span className="sr-only">, done</span>}
                    </button>
                    {meta.length > 0 && (
                      <p className={`mt-0.5 flex flex-wrap gap-x-2 text-xs ${selected ? "text-ink-2" : "text-ink-3"}`}>
                        {row.when && <span className="tabular">{row.when}</span>}
                        {row.area && <span>{row.area}</span>}
                        {others.shown && (
                          <span>
                            <span aria-hidden="true">{others.shown}</span>
                            <span className="sr-only">also {others.spoken}</span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
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
