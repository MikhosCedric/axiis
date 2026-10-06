"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
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
  TodayIcon,
  WeekIcon,
} from "./icons";
import { ThemeToggle } from "./theme-toggle";

export type NavArea = { id: string; name: string; open: number };

const quiet =
  "flex items-center gap-2.5 rounded-md p-2 font-medium text-ink-2 hover:bg-accent-wash max-rail:p-1.5";

function Soon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="max-rail:hidden">
      <span className="flex items-center gap-2.5 p-2 text-ink-3">
        {icon}
        {label}
        <span className="ml-auto text-xs">soon</span>
      </span>
    </li>
  );
}

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
  const onSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  const onNotes = pathname === "/notes" || pathname.startsWith("/notes/");
  const onSearch = pathname === "/search";
  const openPalette = useOpenPalette();
  const mac = useIsMac();
  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-3.5 border-b border-rule bg-paper-2 px-4 py-3 max-rail:[&>*]:shrink-0 max-rail:overflow-x-auto max-rail:[scrollbar-width:none] rail:sticky rail:top-0 rail:h-dvh rail:flex-col rail:items-stretch rail:gap-7 rail:border-r rail:border-b-0 rail:px-4 rail:py-6"
    >
      <div className="flex items-center gap-2.5 rail:px-2">
        <BrandMark />
        <span className="font-serif text-xl leading-none font-semibold tracking-[-0.01em] rail:text-[22px]">Axiis</span>
      </div>

      <ul className="flex gap-0.5 rail:grid">
        <NavLink href="/today" current={onToday} icon={<TodayIcon />} label="Today" />
        <NavLink href="/week" current={onWeek} icon={<WeekIcon />} label="Week" />
        <Soon icon={<InboxIcon />} label="Inbox" />
        <NavLink href="/notes" current={onNotes} icon={<NotesIcon />} label="Notes" />
        <NavLink href="/search" current={onSearch} icon={<SearchIcon />} label="Search" />
        <Soon icon={<ListsIcon />} label="Lists" />
      </ul>

      {areas.length > 0 && (
        <section aria-labelledby="areas-h" className="max-rail:hidden">
          <h2 id="areas-h" className="mx-2 mb-2.5 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">
            Areas
          </h2>
          <ul className="grid gap-0.5">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 p-2 font-medium text-ink-2">
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

      <div className="ml-auto flex items-center gap-1 rail:mt-auto rail:ml-0 rail:grid rail:gap-0.5">
        <button
          type="button"
          onClick={openPalette}
          aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
          title={`Search and commands (${mac ? "⌘" : "Ctrl"} K)`}
          className={`${quiet} w-full whitespace-nowrap rail:gap-2 rail:pr-1`}
        >
          <PaletteIcon />
          <span className="max-rail:sr-only">Search and commands</span>
        </button>
        <ThemeToggle className={`${quiet} w-full`} />
        <Link
          href="/settings"
          aria-current={onSettings ? "page" : undefined}
          className={`${quiet} w-full ${onSettings ? "bg-accent-wash text-ink" : ""}`}
        >
          <SettingsIcon />
          <span className="max-rail:sr-only">Settings</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${quiet} w-full`}>
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
