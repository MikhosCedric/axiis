"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RAIL_COOKIE } from "./cookies";
import { AreaMark } from "@/components/area-mark";
import type { AreaColor } from "@/domain/area-color";
import type { LocalDate } from "@/domain/item";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { AREA_PARAM, areaHref, filterable } from "@/features/filter/href";
import { useOpenPalette } from "@/features/palette/palette";
import { useIsMac } from "@/features/palette/use-is-mac";
import {
  BrandMark,
  DueIcon,
  InboxIcon,
  ListsIcon,
  MonthIcon,
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

/** Counts shown beside a place: the Inbox's waiting items, and the Due items already past their date. */
export type NavBadges = { inbox: number; overdue: number };

export type NavArea = { id: string; name: string; color: AreaColor | null; open: number };

const ICONS: Record<PlaceId, ReactNode> = {
  today: <TodayIcon />,
  week: <WeekIcon />,
  month: <MonthIcon />,
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

const base = "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium";
const quiet = `${base} text-ink-2 hover:bg-hover hover:text-ink active:bg-press`;
/**
 * The current place: a sheet of paper raised off the rail, its label in full ink, with an ink tick
 * at its leading edge (the Ink-for-Selection rule). The tick carries the state on its own.
 */
const current = `${base} relative bg-sheet text-ink font-semibold [--ground:var(--sheet)] shadow-[0_1px_2px_rgb(14_12_10/0.08),inset_0_0_0_1px_var(--rule-soft)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-ink`;
const overline = "text-xs font-medium text-ink-3";

/** A place's link, keeping the page's area or tag filter when that place can show one. */
function usePlaceHref(): (href: string) => string {
  const keep = useKeepFilter();
  return (href) => (filterable(href) ? keep(href) : href);
}

const NO_BADGES: NavBadges = { inbox: 0, overdue: 0 };

/** The number for a place, if it has one: the Inbox counts quietly, overdue in full ink. */
function badgeFor(id: PlaceId, badges: NavBadges): { n: number; word: string; hot: boolean } | null {
  if (id === "inbox" && badges.inbox > 0) return { n: badges.inbox, word: `${badges.inbox} waiting for a day`, hot: false };
  if (id === "due" && badges.overdue > 0) return { n: badges.overdue, word: `${badges.overdue} past due`, hot: true };
  return null;
}

function Badge({ n, hot, className = "" }: { n: number; hot: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`rounded-full px-1.5 text-xs leading-5 font-semibold tabular ${hot ? "bg-ink text-paper" : "bg-hover text-ink-2"} ${className}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function NavRail({ today, areas, badges = NO_BADGES, min = false }: { today: LocalDate; areas: NavArea[]; badges?: NavBadges; min?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      <PhoneHeader />
      <Rail pathname={pathname} today={today} areas={areas} badges={badges} min={min} />
      <PhoneBar pathname={pathname} today={today} areas={areas} badges={badges} />
    </>
  );
}

function Rail({ pathname, today, areas, badges, min: savedMin }: { pathname: string; today: LocalDate; areas: NavArea[]; badges: NavBadges; min: boolean }) {
  // The sidebar folds to icons; the choice is remembered in a cookie the layout reads, so it never flashes the other way.
  const [min, setMin] = useState(savedMin);
  function toggle() {
    const next = !min;
    setMin(next);
    document.cookie = `${RAIL_COOKIE}=${next ? "min" : "full"}; path=/; max-age=31536000; samesite=lax`;
    document.getElementById("app-shell")?.style.setProperty("--rail-w", next ? "64px" : "216px");
  }
  return (
    <nav
      aria-label="Primary"
      data-min={min ? "" : undefined}
      className="group/rail sticky top-0 flex h-dvh flex-col gap-6 overflow-x-hidden overflow-y-auto border-r border-rule-soft bg-paper-2 px-4 py-6 data-[min]:px-2.5 max-rail:hidden"
    >
      <div className="flex items-center justify-between group-data-[min]/rail:flex-col group-data-[min]/rail:gap-3">
        <Wordmark />
        <button
          type="button"
          onClick={toggle}
          aria-label={min ? "Expand the sidebar" : "Collapse the sidebar"}
          title={min ? "Expand the sidebar" : "Collapse the sidebar"}
          className="flex size-8 flex-none items-center justify-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink active:bg-press"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={min ? "rotate-180" : ""}>
            <path d="M9.5 4L5.5 8l4 4" />
          </svg>
        </button>
      </div>
      <SearchField />

      <div className="grid gap-5">
        {PLACE_GROUPS.map((group) => (
          <PlaceList key={group} heading={group} places={PLACES.filter((p) => p.group === group)} pathname={pathname} today={today} badges={badges} />
        ))}
      </div>

      {areas.length > 0 && (
        <section aria-labelledby="areas-h" className="border-t border-rule-soft pt-4 group-data-[min]/rail:hidden">
          <h2 id="areas-h" className={`mx-2 mb-2 ${overline}`}>
            Open today, by area
          </h2>
          <AreaLinks areas={areas} />
        </section>
      )}

      <AccountMenu settingsHere={SETTINGS.here(pathname, today)} />
    </nav>
  );
}

function PlaceList({ heading, places, pathname, today, badges }: { heading: string; places: Place[]; pathname: string; today: LocalDate; badges: NavBadges }) {
  const id = useId();
  const hrefOf = usePlaceHref();
  return (
    <div>
      <h2 id={id} className={`mx-2 mb-1.5 group-data-[min]/rail:sr-only ${overline}`}>
        {heading}
      </h2>
      <ul aria-labelledby={id} className="grid gap-0.5">
        {places.map((p) => {
          const here = p.here(pathname, today);
          const badge = badgeFor(p.id, badges);
          return (
            <li key={p.id}>
              <Link
                href={hrefOf(p.href)}
                title={p.hint}
                aria-current={here ? "page" : undefined}
                aria-describedby={badge ? `${id}-${p.id}` : undefined}
                className={`${here ? current : quiet} relative pointer-coarse:min-h-11 group-data-[min]/rail:justify-center`}
              >
                {ICONS[p.id]}
                <span className="group-data-[min]/rail:sr-only">{p.label}</span>
                {badge && (
                  <Badge n={badge.n} hot={badge.hot} className="ml-auto group-data-[min]/rail:absolute group-data-[min]/rail:top-0 group-data-[min]/rail:right-0 group-data-[min]/rail:ml-0 group-data-[min]/rail:px-1 group-data-[min]/rail:text-[10px] group-data-[min]/rail:leading-4" />
                )}
              </Link>
              {badge && (
                <span id={`${id}-${p.id}`} className="sr-only">
                  {badge.word}
                </span>
              )}
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
      className="flex h-9 w-full items-center gap-1.5 rounded-lg border border-rule bg-sheet pr-1.5 pl-2 text-left text-[13px] text-ink-3 [--ground:var(--sheet)] hover:border-field hover:text-ink-2 pointer-coarse:min-h-11 group-data-[min]/rail:justify-center group-data-[min]/rail:px-0 [&>svg]:size-4"
    >
      <SearchIcon />
      <span className="min-w-0 flex-1 truncate group-data-[min]/rail:sr-only">Search or go to…</span>
      <kbd aria-hidden="true" className="flex-none group-data-[min]/rail:hidden rounded border border-rule px-1 font-sans text-[10.5px] leading-4 font-semibold text-ink-3">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/** The area a page is narrowed to: a raised sheet with the ink tick, like the current place. */
const areaHere =
  "relative bg-sheet text-ink font-semibold [--ground:var(--sheet)] shadow-[inset_0_0_0_1px_var(--rule-soft)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-ink";

/**
 * Each area with how many items it has open today. Choosing one narrows the page you are on to it
 * (or Today, from a page that cannot be narrowed); choosing it again shows every area. Set smaller and
 * lighter than the places, since it is a lens on them rather than a place of its own.
 */
function AreaLinks({ areas, chips = false, onGo }: { areas: NavArea[]; chips?: boolean; onGo?: () => void }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const shown = new URLSearchParams(query).get(AREA_PARAM);
  const look = (here: boolean) =>
    chips
      ? `inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[15px] ${here ? "border-ink font-semibold text-ink shadow-[inset_0_0_0_1px_var(--ink)]" : "border-rule text-ink-2 hover:bg-hover hover:text-ink active:bg-press"}`
      : `flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] pointer-coarse:min-h-11 ${here ? areaHere : "text-ink-2 hover:bg-hover hover:text-ink active:bg-press"}`;
  return (
    <ul className={chips ? "flex flex-wrap gap-2 px-5 pt-1 pb-1" : "grid gap-0.5"}>
      {areas.map((a, i) => {
        const here = shown === a.id && filterable(pathname);
        const keys = i < 9 ? ` (A then ${i + 1})` : "";
        return (
          <li key={a.id}>
            <Link
              href={areaHref(pathname, query, here ? null : a.id)}
              // The same page under another filter: prefetching it would draw a hidden copy of the page for each area.
              prefetch={false}
              aria-current={here ? "true" : undefined}
              title={here ? "Show all areas (A then 0)" : `Show only ${a.name}${keys}`}
              onClick={onGo}
              className={look(here)}
            >
              {/* In the rail an area with no colour keeps the dot's room, so every name starts at one edge. */}
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {a.color ? <AreaMark color={a.color} /> : !chips && <span aria-hidden="true" className="size-2 flex-none" />}
                <span className="truncate">{a.name}</span>
              </span>
              <span className="sr-only">
                , {a.open} open today{here ? ", shown alone; choose again to show every area" : ""}
              </span>
              {a.open > 0 && !chips && (
                <span
                  aria-hidden="true"
                  title={`${a.open} open today`}
                  className="ml-auto h-1.5 flex-none rounded-full bg-ink-3 opacity-55"
                  style={{ width: Math.min(8 + a.open * 7, 72) }}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => menu.current?.hidePopover();

  useEffect(() => {
    menu.current?.hidePopover();
  }, [pathname]);

  return (
    <div className="mt-auto">
      <button type="button" popoverTarget={id} aria-expanded={open} className={`${settingsHere ? current : quiet} w-full pointer-coarse:min-h-11 group-data-[min]/rail:justify-center`}>
        <SettingsIcon />
        <span className="flex-1 text-left group-data-[min]/rail:sr-only">Account</span>
        <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="flex-none text-ink-3 group-data-[min]/rail:hidden" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
          setOpen(e.newState === "open");
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
    <div className="flex items-center gap-2.5 rail:px-2 group-data-[min]/rail:justify-center group-data-[min]/rail:px-0">
      <BrandMark />
      <span className="group-data-[min]/rail:sr-only font-display text-xl leading-none font-semibold tracking-[-0.01em] rail:text-[22px]">Axiis</span>
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
    <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rule-soft px-4 rail:hidden">
      <Wordmark />
      <button
        type="button"
        onClick={openPalette}
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press"
      >
        <SearchIcon />
        <span className="sr-only">Search or go to</span>
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
function PhoneBar({ pathname, today, areas, badges }: { pathname: string; today: LocalDate; areas: NavArea[]; badges: NavBadges }) {
  const tabId = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const hrefOf = usePlaceHref();
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
      className="glass-rail fixed inset-x-0 bottom-0 z-30 border-t border-rule pb-[env(safe-area-inset-bottom)] rail:hidden"
    >
      <ul className="flex h-16">
        {tabs.map((p) => {
          const here = p.here(pathname, today);
          const badge = badgeFor(p.id, badges);
          return (
            <li key={p.id} className="flex flex-1">
              <Link
                href={hrefOf(p.href)}
                aria-current={here ? "page" : undefined}
                aria-describedby={badge ? `${tabId}-${p.id}` : undefined}
                className={here ? tabHere : tabQuiet}
              >
                {ICONS[p.id]}
                {p.label}
                {badge && <Badge n={badge.n} hot={badge.hot} className="absolute top-1.5 left-1/2 ml-1.5 min-w-5 text-center" />}
              </Link>
              {badge && (
                <span id={`${tabId}-${p.id}`} className="sr-only">
                  {badge.word}
                </span>
              )}
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
        {areas.length > 0 && (
          <div className="mt-3 border-t border-rule-soft pt-3">
            <h2 className={`mx-5 mb-1 ${overline}`}>Open today, by area</h2>
            <AreaLinks areas={areas} chips onGo={close} />
          </div>
        )}
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

/** A place in the More sheet: its name, and under it what the place holds. Both are its name, as both are drawn. */
function SheetPlace({ place, here, onGo }: { place: Place; here: boolean; onGo: () => void }) {
  const hrefOf = usePlaceHref();
  return (
    <li>
      <Link
        href={hrefOf(place.href)}
        aria-current={here ? "page" : undefined}
        onClick={onGo}
        className={`${here ? current : quiet} ${sheetRow} py-2`}
      >
        {ICONS[place.id]}
        <span className="grid">
          <span>{place.label}</span>{" "}
          <span className="text-[13px] font-normal text-ink-3">
            {place.hint}
          </span>
        </span>
      </Link>
    </li>
  );
}
