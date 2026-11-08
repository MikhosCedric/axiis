"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Returns to the page the visitor came from, or to `fallback` when this page was opened directly. */
export function BackLink({ fallback = "/today", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || window.history.length <= 1) return;
        e.preventDefault();
        router.back();
      }}
      className="-ml-1.5 inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 text-[13px] text-ink-2 hover:bg-hover active:bg-press hover:text-ink pointer-coarse:min-h-11"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 3 5 8l5 5" />
      </svg>
      {label}
    </Link>
  );
}
