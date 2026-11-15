"use client";

import { useRouter } from "next/navigation";
import { HIDDEN_AREAS_COOKIE } from "@/components/shell/cookies";
import { hiddenIn, type ViewFilter } from "./model";

/** "1 area hidden", "2 areas hidden": what the note says. Nothing is hidden while the address names one area. */
export function hiddenWords(f: ViewFilter): string | null {
  const n = hiddenIn(f).length;
  return n === 0 ? null : `${n} ${n === 1 ? "area" : "areas"} hidden`;
}

/**
 * "2 areas hidden · Show all", under a page's summary while areas are unticked in the side panel, so
 * nobody wonders where their items went. Show all ticks every area again, on every page of this device.
 */
export function HiddenAreasNote({ filter, className = "" }: { filter: ViewFilter; className?: string }) {
  const router = useRouter();
  const words = hiddenWords(filter);
  if (!words) return null;

  function showAll() {
    document.cookie = `${HIDDEN_AREAS_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.refresh();
  }

  return (
    <p data-hidden-areas className={`flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2 ${className}`}>
      <span>{words}</span>
      <span aria-hidden="true" className="text-ink-3">
        ·
      </span>
      <button
        type="button"
        onClick={showAll}
        className="-mx-1 rounded px-1 font-medium text-ink underline decoration-rule underline-offset-2 hover:bg-hover hover:decoration-ink active:bg-press pointer-coarse:min-h-11"
      >
        Show all
      </button>
    </p>
  );
}
