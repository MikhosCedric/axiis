"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
import { DUE_PATH } from "@/features/due/model";
import { LISTS_PATH } from "@/features/lists/model";
import { PaletteIcon } from "@/features/palette/icons";
import { useOpenPalette } from "@/features/palette/palette";
import { useIsMac } from "@/features/palette/use-is-mac";
import {
  BrandMark,
  DueIcon,
  InboxIcon,
  ListsIcon,
  MoreIcon,
  NotesIcon,
  SearchIcon,
  SettingsIcon,
  SignOutIcon,
  TagsIcon,
  TodayIcon,
  WeekIcon,
} from "./icons";
import styles from "./nav.module.css";
import { ThemeToggle } from "./theme-toggle";

export type NavArea = { id: string; name: string; open: number };

/** Where each place lives: every one is on the rail; on a phone the first four are tabs and the rest sit under More. */
type Place = { href: string; label: string; icon: ReactNode; here: (path: string, today: LocalDate) => boolean; tab: boolean };

const under = (root: string) => (path: string) => path === root || path.startsWith(`${root}/`);

const PLACES: Place[] = [
  { href: "/today", label: "Today", icon: <TodayIcon />, here: (p, today) => p === "/today" || p === `/day/${today}`, tab: true },
  { href: "/week", label: "Week", icon: <WeekIcon />, here: under("/week"), tab: true },
  { href: "/inbox", label: "Inbox", icon: <InboxIcon />, here: (p) => p === "/inbox", tab: true },
  { href: DUE_PATH, label: "Due", icon: <DueIcon />, here: (p) => p === DUE_PATH, tab: true },
  { href: LISTS_PATH, label: "Lists", icon: <ListsIcon />, here: (p) => p === LISTS_PATH, tab: false },
  { href: "/notes", label: "Notes", icon: <NotesIcon />, here: under("/notes"), tab: false },
  { href: "/tags", label: "Tags", icon: <TagsIcon />, here: under("/tags"), tab: false },
  { href: "/search", label: "Search", icon: <SearchIcon />, here: (p) => p === "/search", tab: false },
];

const onSettings = under("/settings");

const base = "flex items-center gap-2.5 rounded-md p-2 font-medium";
const quiet = `${base} text-ink-2 hover:bg-hover hover:text-ink active:bg-press`;
/**
 * The current place: a sheet of paper raised off the rail, its label in full ink, with an ink tick
 * at its leading edge (the Ink-for-Selection rule). The tick carries the state on its own.
 */
const current = `${base} relative bg-sheet text-ink font-semibold [--ground:var(--sheet)] shadow-[0_1px_2px_rgb(14_12_10/0.08),inset_0_0_0_1px_var(--rule-soft)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-ink`;
const tool = `${quiet} w-full`;

export function NavRail({ today, areas }: { today: LocalDate; areas: NavArea[] }) {
  const pathname = usePathname();
  return (
    <>
      <PhoneHeader />
      <Rail pathname={pathname} today={today} areas={areas} />
      <PhoneBar pathname={pathname} today={today} />
    </>
  );
}

function Rail({ pathname, today, areas }: { pathname: string; today: LocalDate; areas: NavArea[] }) {
  const openPalette = useOpenPalette();
  const mac = useIsMac();
  const settings = onSettings(pathname);
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 flex h-dvh flex-col gap-7 border-r border-rule bg-paper-2 px-4 py-6 max-rail:hidden"
    >
      <Wordmark />

      <ul className="grid gap-0.5">
        {PLACES.map((p) => {
          const here = p.here(pathname, today);
          return (
            <li key={p.href}>
              <Link href={p.href} aria-current={here ? "page" : undefined} className={`${here ? current : quiet} pointer-coarse:min-h-11`}>
                {p.icon}
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {areas.length > 0 && (
        <section aria-labelledby="areas-h">
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

      <div className="mt-auto grid gap-0.5">
        <button
          type="button"
          onClick={openPalette}
          aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
          title={`Search and commands (${mac ? "⌘" : "Ctrl"} K)`}
          className={`${tool} gap-2 whitespace-nowrap pr-1`}
        >
          <PaletteIcon />
          <span>Search and commands</span>
        </button>
        <ThemeToggle className={tool} />
        <Link href="/settings" aria-current={settings ? "page" : undefined} className={settings ? `${current} w-full` : tool}>
          <SettingsIcon />
          <span>Settings</span>
        </Link>
        <SignOut className={tool} />
        <p className="mt-2 flex gap-3 px-2 text-xs text-ink-3">
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

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 rail:px-2">
      <BrandMark />
      <span className="font-serif text-xl leading-none font-semibold tracking-[-0.01em] rail:text-[22px]">Axiis</span>
    </div>
  );
}

function SignOut({ className }: { className: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className}>
        <SignOutIcon />
        <span>Sign out</span>
      </button>
    </form>
  );
}

/** A phone's top line: the wordmark, and the palette, which is how a phone searches and jumps. */
function PhoneHeader() {
  const openPalette = useOpenPalette();
  return (
    <header className="flex h-14 items-center justify-between border-b border-rule-soft bg-paper px-4 rail:hidden">
      <Wordmark />
      <button
        type="button"
        onClick={openPalette}
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press"
      >
        <PaletteIcon />
        <span className="sr-only">Search and commands</span>
      </button>
    </header>
  );
}

const tab =
  "relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [&_svg]:size-5";
const tabQuiet = `${tab} text-ink-3 hover:text-ink active:bg-press`;
/** On a phone the current tab is full ink with an ink tick along its top edge, the rail's tick turned on its side. */
const tabHere = `${tab} text-ink font-semibold before:absolute before:top-0 before:left-1/2 before:h-[3px] before:w-6 before:-translate-x-1/2 before:rounded-b-full before:bg-ink`;

/**
 * The phone's places: four tabs a thumb reaches, and More, a sheet with the rest. The bar is fixed to the
 * bottom of the screen on Rail Paper; the page leaves room for it (see the (app) layout).
 */
function PhoneBar({ pathname, today }: { pathname: string; today: LocalDate }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tabs = PLACES.filter((p) => p.tab);
  const rest = PLACES.filter((p) => !p.tab);
  const moreHere = onSettings(pathname) || rest.some((p) => p.here(pathname, today));

  // A link in the sheet navigates; the sheet goes with the page it was opened on.
  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper-2 pb-[env(safe-area-inset-bottom)] rail:hidden"
    >
      <ul className="flex h-16">
        {tabs.map((p) => {
          const here = p.here(pathname, today);
          return (
            <li key={p.href} className="flex flex-1">
              <Link href={p.href} aria-current={here ? "page" : undefined} className={here ? tabHere : tabQuiet}>
                {p.icon}
                {p.label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button
            ref={button}
            type="button"
            aria-haspopup="dialog"
            aria-controls="more-sheet"
            onClick={() => sheet.current?.showModal()}
            className={moreHere ? tabHere : tabQuiet}
          >
            <MoreIcon />
            More
          </button>
        </li>
      </ul>

      <dialog
        ref={sheet}
        id="more-sheet"
        aria-label="More"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        onClose={() => button.current?.focus()}
        className={styles.sheet}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-rule" aria-hidden="true" />
        <ul className="px-2">
          {rest.map((p) => {
            const here = p.here(pathname, today);
            return (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={here ? "page" : undefined}
                  onClick={() => sheet.current?.close()}
                  className={`${here ? current : quiet} min-h-12 px-3 text-[15px]`}
                >
                  {p.icon}
                  {p.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mx-5 my-2 border-t border-rule-soft" />
        <div className="grid px-2">
          <ThemeToggle className={`${quiet} min-h-12 w-full px-3 text-[15px]`} />
          <Link
            href="/settings"
            aria-current={onSettings(pathname) ? "page" : undefined}
            onClick={() => sheet.current?.close()}
            className={`${onSettings(pathname) ? current : quiet} min-h-12 px-3 text-[15px]`}
          >
            <SettingsIcon />
            <span>Settings</span>
          </Link>
          <SignOut className={`${quiet} min-h-12 w-full px-3 text-[15px]`} />
        </div>
        <p className="flex gap-4 px-5 pt-3 pb-5 text-xs text-ink-3">
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
            Terms
          </Link>
        </p>
      </dialog>
    </nav>
  );
}
