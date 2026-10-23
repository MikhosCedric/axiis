"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AreaMark } from "@/components/area-mark";
import type { AreaColor } from "@/domain/area-color";
import { useTagColor } from "@/features/tags/tag-colors";
import { AREA_PARAM, TAG_PARAM, withFilter, type ViewFilter } from "./model";

/**
 * Keeps the address's filter on a link to another view, so moving a day, a week or
 * a month, or switching between them, stays inside the same area or tag. The
 * values pass through as they are; the page that receives them checks them.
 */
export function useKeepFilter(): (href: string) => string {
  const params = useSearchParams();
  const area = params.get(AREA_PARAM) ?? undefined;
  const tag = params.get(TAG_PARAM) ?? undefined;
  return useCallback((href: string) => (area || tag ? withFilter(href, { area, tag }) : href), [area, tag]);
}

/** This page's address with one filter value removed. An open item stays open: the wider view holds it too. */
function useWithout(key: "area" | "tag"): string {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.delete(key === "area" ? AREA_PARAM : TAG_PARAM);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-rule bg-sheet pr-1 pl-3 text-[13px] font-medium text-ink [--ground:var(--sheet)] pointer-coarse:h-11";
const remove =
  "grid size-6 place-items-center rounded-full text-ink-3 hover:bg-hover hover:text-ink active:bg-press pointer-coarse:size-9";

function Cross() {
  return (
    <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}

function Chip({ label, color, href }: { label: string; color: AreaColor | null; href: string }) {
  return (
    <span className={chip}>
      <AreaMark color={color} />
      {label}
      <Link href={href} scroll={false} className={remove} title={`Show all, not only ${label}`}>
        <Cross />
        <span className="sr-only">Stop showing only {label}</span>
      </Link>
    </span>
  );
}

/**
 * "Showing: ● Work ×" at the top of a filtered page: what the view is narrowed to, each part
 * with its own way out. Nothing when the view is whole.
 */
export function FilterChips({ filter, className = "" }: { filter: ViewFilter; className?: string }) {
  const withoutArea = useWithout("area");
  const withoutTag = useWithout("tag");
  const tagColor = useTagColor();
  if (!filter.area && !filter.tag) return null;
  return (
    <p role="group" aria-label="Filter" data-filter className={`flex flex-wrap items-center gap-2 text-[13px] text-ink-2 ${className}`}>
      <span>Showing only</span>
      {filter.area && <Chip label={filter.area.name} color={filter.area.color} href={withoutArea} />}
      {filter.tag && <Chip label={`#${filter.tag}`} color={tagColor(filter.tag)} href={withoutTag} />}
    </p>
  );
}
