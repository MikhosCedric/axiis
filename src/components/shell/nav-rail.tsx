"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
import { LISTS_PATH } from "@/features/lists/model";
import { PaletteIcon } from "@/features/palette/icons";
import { useIsMac, useOpenPalette } from "@/features/palette/palette";
import {
  BrandMark,
  InboxIcon,
  ListsIcon,
  NotesIcon,
  SearchIcon,
  SettingsIcon,
  SignOutIcon,
  TagsIcon,
  TodayIcon,
  WeekIcon,
} from "./icons";
import { ThemeToggle } from "./theme-toggle";

export type NavArea = { id: string; name: string; open: number };

const quiet =
  "flex items-center gap-2.5 rounded-md p-2 font-medium text-ink-2 hover:bg-accent-wash max-rail:p-1.5";
const tool = `${quiet} max-rail:size-11 max-rail:justify-center rail:w-full`;

function NavLink({ href, current, icon, label }: { href: string; current: boolean; icon: ReactNode; label: string }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={
          current
            ? "flex items-center gap-2.5 rounded-md bg-ink p-2 font-medium text-paper max-rail:px-2.5 max-rail:py-1.5"
            : `${quiet} max-rail:px-2.5`
        }
      >
        {icon}
        {label}
      </Link>
    </li>
  );
}

export function NavRail({ today, areas }: { today: LocalDate; areas: NavArea[] }) {
  const pathname = usePathname();
  const onToday = pathname === "/today" || pathname === `/day/${today}`;
  const onWeek = pathname === "/week" || pathname.startsWith("/week/");
  const onInbox = pathname === "/inbox";
  const onLists = pathname === LISTS_PATH;
  const onSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  const onNotes = pathname === "/notes" || pathname.startsWith("/notes/");
  const onSearch = pathname === "/search";
  const onTags = pathname === "/tags" || pathname.startsWith("/tags/");
  const openPalette = useOpenPalette();
  const mac = useIsMac();
  return (
    <nav
      aria-label="Primary"
      className="relative flex items-center border-b border-rule bg-paper-2 px-4 max-rail:flex-wrap max-rail:gap-x-3.5 max-rail:pt-1.5 rail:sticky rail:top-0 rail:h-dvh rail:flex-col rail:items-stretch rail:gap-7 rail:border-r rail:border-b-0 rail:px-4 rail:py-6"
    >
      <div className="flex items-center gap-2.5 rail:px-2">
        <BrandMark />
        <span className="font-serif text-xl leading-none font-semibold tracking-[-0.01em] rail:text-[22px]">Axiis</span>
      </div>

      {/* On a phone the links get their own row that runs off the right edge, so it reads as one that scrolls. */}
      <ul className="flex gap-0.5 max-rail:order-last max-rail:-mx-4 max-rail:basis-[calc(100%+2rem)] max-rail:overflow-x-auto max-rail:px-4 max-rail:pt-1 max-rail:pb-2 max-rail:[scrollbar-width:none] max-rail:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] max-rail:[&>li]:shrink-0 max-rail:after:block max-rail:after:w-4 max-rail:after:shrink-0 rail:grid">
        <NavLink href="/today" current={onToday} icon={<TodayIcon />} label="Today" />
        <NavLink href="/week" current={onWeek} icon={<WeekIcon />} label="Week" />
        <NavLink href="/inbox" current={onInbox} icon={<InboxIcon />} label="Inbox" />
        <NavLink href={LISTS_PATH} current={onLists} icon={<ListsIcon />} label="Lists" />
        <NavLink href="/notes" current={onNotes} icon={<NotesIcon />} label="Notes" />
        <NavLink href="/tags" current={onTags} icon={<TagsIcon />} label="Tags" />
        <NavLink href="/search" current={onSearch} icon={<SearchIcon />} label="Search" />
      </ul>

      {areas.length > 0 && (
        <section aria-labelledby="areas-h" className="max-rail:hidden">
          <h2 id="areas-h" className="mx-2 mb-2.5 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">
            Areas
          </h2>
          {/* A quiet readout, not links: smaller, lighter and tighter than the nav above. */}
          <ul className="grid">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-2 py-1 text-[13px] text-ink-3">
                <span className="min-w-0 truncate">{a.name}</span>
                <span className="sr-only">, {a.open} open today</span>
                {a.open > 0 && (
                  <span
                    aria-hidden="true"
                    title={`${a.open} open today`}
                    className="ml-auto h-1.5 flex-none rounded-full bg-ink-3 opacity-55"
                    style={{ width: Math.min(8 + a.open * 7, 72) }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ml-auto flex items-center gap-1 max-rail:py-1 rail:mt-auto rail:ml-0 rail:grid rail:gap-0.5">
        <button
          type="button"
          onClick={openPalette}
          aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
          title={`Search and commands (${mac ? "⌘" : "Ctrl"} K)`}
          className={`${tool} whitespace-nowrap rail:gap-2 rail:pr-1`}
        >
          <PaletteIcon />
          <span className="max-rail:sr-only">Search and commands</span>
        </button>
        <ThemeToggle className={tool} />
        <Link
          href="/settings"
          aria-current={onSettings ? "page" : undefined}
          className={`${tool} ${onSettings ? "bg-accent-wash text-ink" : ""}`}
        >
          <SettingsIcon />
          <span className="max-rail:sr-only">Settings</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className={tool}>
            <SignOutIcon />
            <span className="max-rail:sr-only">Sign out</span>
          </button>
        </form>
        <p className="mt-2 flex gap-3 px-2 text-xs text-ink-3 max-rail:hidden">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </nav>
  );
}
