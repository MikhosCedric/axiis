"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuick } from "@/features/actions/context";
import { RowActions, rowProps } from "@/features/actions/row-actions";
import { TYPE_WORD, type SearchRow } from "./model";

/** One search hit, a link to it, with the quick actions at its end. */
export function SearchResult({ row }: { row: SearchRow }) {
  const quick = useQuick();
  const router = useRouter();
  const patch = quick?.patched(row.id);
  if (patch?.hidden) return null;
  const title = patch?.title ?? row.title;
  const done = patch?.done ?? row.done;
  const qi = { ...row.quick, title, done };
  const hooks = { onOpen: () => router.push(row.href) };
  return (
    <li {...rowProps(quick, qi, hooks)} className="group/row relative border-b border-rule-soft">
      <Link href={row.href} data-quick-focus className="block rounded-md px-2 py-3 hover:bg-hover active:bg-press pointer-coarse:pr-14">
        <span className={`block truncate font-medium ${done ? "text-ink-3" : "text-ink"}`}>{title}</span>
        {row.snippet && <span className="mt-0.5 line-clamp-2 block text-ink-2">{row.snippet}</span>}
        <span className="mt-1 block text-[13px] text-ink-3">
          {TYPE_WORD[row.type]}
          {done ? ", done" : ""}
        </span>
      </Link>
      <RowActions item={qi} hooks={hooks} className="absolute top-2 right-2 bg-paper" />
    </li>
  );
}
