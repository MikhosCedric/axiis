"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useOptimistic, useTransition, type ReactNode } from "react";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { DetailAside } from "@/features/detail/detail-aside";
import { CaptureField } from "@/features/today/capture-field";
import type { CaptureResult } from "@/features/today/commands";
import { Glyph } from "@/features/today/glyph";
import { RepeatMark } from "@/features/today/repeat-mark";
import { captureChecklistAction } from "./actions";
import { listsSummary, progressShare, progressWords, type ListRow, type ListsData } from "./model";

/** Every checklist, open first, with how far along each is. A row opens the detail panel, where its lines live. */
export function ListsView({
  data,
  detail,
  capture = captureChecklistAction,
}: {
  data: ListsData;
  detail?: ReactNode;
  /** Defaults to the server action; the dev harness passes an in-memory one. */
  capture?: (title: string) => Promise<CaptureResult>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
  const [, startTransition] = useTransition();

  function select(id: string) {
    startTransition(() => {
      setSelectedId(id);
      const next = new URLSearchParams(params.toString());
      next.set(SELECTED_ITEM_PARAM, id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // A new checklist opens beside the list at once, since its lines are the next thing to write.
  async function captureAndOpen(title: string): Promise<CaptureResult> {
    const result = await capture(title);
    if (result.ok) select(result.id);
    return result;
  }

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">Lists</h1>
        <p className="mt-2.5 text-[15px] text-ink-2">{listsSummary(data.rows)}</p>

        <div className="mt-6">
          <CaptureField captureAction={captureAndOpen} label="New checklist" placeholder="Name a checklist, then add its lines" />
        </div>

        {data.rows.length > 0 ? (
          <ul className="mt-2 max-w-[760px] border-t border-rule">
            {data.rows.map((row) => (
              <ListRowView key={row.id} row={row} selected={selectedId === row.id} onSelect={() => select(row.id)} />
            ))}
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

function ListRowView({ row, selected, onSelect }: { row: ListRow; selected: boolean; onSelect: () => void }) {
  const metaId = useId();
  // The quietest ink is too faint to read on the accent wash of a selected row.
  const quiet = selected ? "text-ink-2" : "text-ink-3";
  return (
    <li
      className={`grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule-soft py-2.5 ${selected ? "bg-accent-wash" : ""}`}
    >
      <span className="grid h-6 place-items-center">
        <Glyph type="checklist" state={row.done ? "done" : "planned"} />
      </span>
      <div className="min-w-0">
        <button
          type="button"
          aria-pressed={selected}
          aria-describedby={metaId}
          onClick={onSelect}
          className={`cursor-pointer rounded text-left break-words hover:underline ${row.done ? `font-normal ${quiet}` : "font-medium text-ink"}`}
        >
          {row.title}
          {row.repeats && (
            <>
              <RepeatMark className={`ml-1.5 ${quiet}`} />
              <span className="sr-only">, repeats</span>
            </>
          )}
          {row.done && <span className="sr-only">, done</span>}
        </button>
        <p id={metaId} className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${quiet}`}>
          {row.progress && (
            <span className="flex items-center gap-2">
              <ProgressLine share={progressShare(row.progress)} />
              <span className="tabular">{progressWords(row.progress)}</span>
            </span>
          )}
          {row.when && <span className="tabular">{row.when}</span>}
          {row.area && <span>{row.area}</span>}
        </p>
      </div>
    </li>
  );
}

/**
 * Progress in line form: the part still to do is dashed, like anything
 * planned, and the part done is solid. Decorative, since the words beside it
 * say the same.
 */
function ProgressLine({ share }: { share: number }) {
  return (
    <span aria-hidden="true" className="relative block h-0.5 w-20 flex-none">
      <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-current opacity-60" />
      <span className="absolute inset-y-0 left-0 rounded-full bg-current" style={{ width: `${share * 100}%` }} />
    </span>
  );
}
