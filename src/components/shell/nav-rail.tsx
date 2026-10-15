"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
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
import { place, PLACE_GROUPS, PLACES, type Place, type PlaceId } from "./places";
import { ThemeToggle } from "./theme-toggle";

export type NavArea = { id: string; name: string; open: number };

const ICONS: Record<PlaceId, ReactNode> = {
  today: <TodayIcon />,
  week: <WeekIcon />,
  due: <DueIcon />,
  inbox: <InboxIcon />,
  lists: <ListsIcon />,
  notes: <NotesIcon />,
  tags: <TagsIcon />,
  search: <SearchIcon />,
  settings: <SettingsIcon />,
};

const SEARCH = place("search");
const SETTINGS = place("settings");

const base = "flex items-center gap-2.5 rounded-md p-2 font-medium";
const quiet = `${base} text-ink-2 hover:bg-hover hover:text-ink active:bg-press`;
/**
 * The current place: a sheet of paper raised off the rail, its label in full ink, with an ink tick
 * at its leading edge (the Ink-for-Selection rule). The tick carries the state on its own.
 */
const current = `${base} relative bg-sheet text-ink font-semibold [--ground:var(--sheet)] shadow-[0_1px_2px_rgb(14_12_10/0.08),inset_0_0_0_1px_var(--rule-soft)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-ink`;
const overline = "text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase";

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
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto border-r border-rule bg-paper-2 px-4 py-6 max-rail:hidden"
    >
      <Wordmark />
      <SearchField />

      <div className="grid gap-5">
        {PLACE_GROUPS.map((group) => (
          <PlaceList key={group} heading={group} places={PLACES.filter((p) => p.group === group)} pathname={pathname} today={today} />
        ))}
      </div>

      {areas.length > 0 && <AreaReadout areas={areas} />}

      <AccountMenu settingsHere={SETTINGS.here(pathname, today)} />
    </nav>
  );
}

function PlaceList({ heading, places, pathname, today }: { heading: string; places: Place[]; pathname: string; today: LocalDate }) {
  const id = useId();
  return (
    <div>
      <h2 id={id} className={`mx-2 mb-1.5 ${overline}`}>
        {heading}
      </h2>
      <ul aria-labelledby={id} className="grid gap-0.5">
        {places.map((p) => {
          const here = p.here(pathname, today);
          return (
            <li key={p.id}>
              <Link
                href={p.href}
                title={p.hint}
                aria-current={here ? "page" : undefined}
                className={`${here ? current : quiet} pointer-coarse:min-h-11`}
              >
                {ICONS[p.id]}
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shaped like a field, so it reads as the place to type; it opens the palette, which searches and jumps. */
function SearchField() {
  const openPalette = useOpenPalette();
  const mac = useIsMac();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-rule bg-sheet px-2.5 text-left text-[13px] text-ink-3 [--ground:var(--sheet)] hover:border-field hover:text-ink-2 pointer-coarse:min-h-11"
    >
      <SearchIcon />
      <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
      <kbd aria-hidden="true" className="flex-none rounded border border-rule px-1 font-sans text-[11px] font-semibold text-ink-3">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/** How many open items each area has today: a readout, not links, so it is set smaller and lighter than the places. */
function AreaReadout({ areas }: { areas: NavArea[] }) {
  return (
    <section aria-labelledby="areas-h" className="border-t border-rule-soft pt-4">
      <h2 id="areas-h" className={`mx-2 mb-2 ${overline}`}>
        Open today, by area
      </h2>
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
  );
}

const menuRow = `${quiet} w-full pointer-coarse:min-h-11`;

/**
 * Settings, the theme, the legal pages and signing out, behind one row at the foot of the rail.
 * A native popover: Escape and a click outside close it, and focus goes back to the row.
 */
function AccountMenu({ settingsHere }: { settingsHere: boolean }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const close = () => menu.current?.hidePopover();

  useEffect(() => {
    menu.current?.hidePopover();
  }, [pathname]);

  return (
    <div className="mt-auto">
      <button type="button" popoverTarget={id} className={`${settingsHere ? current : quiet} w-full pointer-coarse:min-h-11`}>
        <SettingsIcon />
        <span className="flex-1 text-left">Account</span>
        <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="flex-none text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7.5L6 4.5l3 3" />
        </svg>
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="group"
        aria-label="Account"
        onToggle={(e) => {
          if (e.newState === "open") menu.current?.querySelector<HTMLElement>("a, button")?.focus();
        }}
        className={styles.menu}
      >
        <Link href={SETTINGS.href} title={SETTINGS.hint} aria-current={settingsHere ? "page" : undefined} onClick={close} className={menuRow}>
          <SettingsIcon />
          <span>{SETTINGS.label}</span>
        </Link>
        <ThemeToggle className={menuRow} />
        <SignOut className={menuRow} />
        <p className="mt-1 flex gap-3 border-t border-rule-soft px-2 pt-2 pb-1 text-xs text-ink-3">
          <Link href="/privacy" onClick={close} className="inline-flex items-center underline-offset-2 hover:underline pointer-coarse:min-h-11">
            Privacy
          </Link>
          <Link href="/terms" onClick={close} className="inline-flex items-center underline-offset-2 hover:underline pointer-coarse:min-h-11">
            Terms
          </Link>
        </p>
      </div>
    </div>
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
        <SearchIcon />
        <span className="sr-only">Search or jump to</span>
      </button>
    </header>
  );
}

const tab =
  "relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [&_svg]:size-5";
const tabQuiet = `${tab} text-ink-3 hover:text-ink active:bg-press`;
/** On a phone the current tab is full ink with an ink tick along its top edge, the rail's tick turned on its side. */
const tabHere = `${tab} text-ink font-semibold before:absolute before:top-0 before:left-1/2 before:h-[3px] before:w-6 before:-translate-x-1/2 before:rounded-b-full before:bg-ink`;

const sheetRow = "min-h-12 px-3 text-[15px]";

/**
 * The phone's places: four tabs a thumb reaches, and More, a sheet with the rest. The bar is fixed to the
 * bottom of the screen on Rail Paper; the page leaves room for it (see the (app) layout).
 */
function PhoneBar({ pathname, today }: { pathname: string; today: LocalDate }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tabs = PLACES.filter((p) => p.tab);
  const rest = PLACES.filter((p) => !p.tab && p.group);
  const settingsHere = SETTINGS.here(pathname, today);
  const moreHere = settingsHere || SEARCH.here(pathname, today) || rest.some((p) => p.here(pathname, today));
  const close = () => sheet.current?.close();

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
            <li key={p.id} className="flex flex-1">
              <Link href={p.href} aria-current={here ? "page" : undefined} className={here ? tabHere : tabQuiet}>
                {ICONS[p.id]}
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
          <SheetPlace place={SEARCH} here={SEARCH.here(pathname, today)} onGo={close} />
        </ul>
        {PLACE_GROUPS.map((group) => {
          const places = rest.filter((p) => p.group === group);
          return (
            places.length > 0 && (
              <SheetSection key={group} heading={group}>
                {places.map((p) => (
                  <SheetPlace key={p.id} place={p} here={p.here(pathname, today)} onGo={close} />
                ))}
              </SheetSection>
            )
          );
        })}
        <SheetSection heading="Account">
          <li>
            <ThemeToggle className={`${quiet} ${sheetRow} w-full`} />
          </li>
          <SheetPlace place={SETTINGS} here={settingsHere} onGo={close} />
          <li>
            <SignOut className={`${quiet} ${sheetRow} w-full`} />
          </li>
        </SheetSection>
        <p className="flex gap-4 px-5 pt-1 pb-5 text-xs text-ink-3">
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

function SheetSection({ heading, children }: { heading: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="mt-3 border-t border-rule-soft pt-3">
      <h2 id={id} className={`mx-5 mb-1 ${overline}`}>
        {heading}
      </h2>
      <ul aria-labelledby={id} className="px-2">
        {children}
      </ul>
    </div>
  );
}

/** A place in the More sheet: its name, and under it what the place holds. */
function SheetPlace({ place, here, onGo }: { place: Place; here: boolean; onGo: () => void }) {
  const hint = useId();
  return (
    <li>
      <Link
        href={place.href}
        aria-label={place.label}
        aria-describedby={hint}
        aria-current={here ? "page" : undefined}
        onClick={onGo}
        className={`${here ? current : quiet} ${sheetRow} py-2`}
      >
        {ICONS[place.id]}
        <span className="grid">
          <span>{place.label}</span>
          <span id={hint} className="text-[13px] font-normal text-ink-3">
            {place.hint}
          </span>
        </span>
      </Link>
    </li>
  );
}
