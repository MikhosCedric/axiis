"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HIDDEN_AREAS_COOKIE, hiddenAreasValue, RAIL_COOKIE } from "./cookies";
import type { AreaColor } from "@/domain/area-color";
import type { LocalDate } from "@/domain/item";
import { DAY_VIEW_PARAM } from "@/features/day/types";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { filterable } from "@/features/filter/href";
import { useOpenPalette } from "@/features/palette/palette";
import { CAPTURE_KEY } from "@/features/palette/shortcuts";
import { useIsMac } from "@/features/palette/use-is-mac";
import { calendarView, keepSpans, spanHrefs, type CalendarView, type Span } from "@/features/week/span";
import { MiniMonth } from "./mini-month";
import { useWeekStart } from "./week-start-context";
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

type CalendarLinks = {
  view: CalendarView;
  /** Where a day picked in the small month goes: that day in the span on screen, or the day itself from any other page. */
  dayHref: (date: LocalDate) => string;
  /** On a calendar view, the day, week and month that hold the day it is about. Null anywhere else. */
  spans: Record<Span, string> | null;
};

/**
 * The side panel is the only switch between the day, the week and the month (ADR-0004), so from a
 * calendar view its three calendar places keep the date on screen, and its small month moves that
 * view to the day picked. The page's area or tag filter and the day's List view come along.
 */
function useCalendarLinks(today: LocalDate): CalendarLinks {
  const pathname = usePathname();
  const params = useSearchParams();
  const startsOn = useWeekStart();
  const keep = useKeepFilter();
  const view = calendarView(pathname, today, startsOn);
  const mode = view.span === "day" && params.get(DAY_VIEW_PARAM) === "list" ? "list" : "score";
  return {
    view,
    dayHref: (date) => keep(spanHrefs(date, today, mode, startsOn)[view.span ?? "day"]),
    spans: view.span ? keepSpans(spanHrefs(view.anchor, today, mode, startsOn), keep) : null,
  };
}

/** A place's name where the panel and the phone bar draw it. */
const navName = (p: Place) => p.navLabel ?? p.label;

/** The tooltip: what the place holds, and the key that switches to it from another calendar view. */
const navTitle = (p: Place) => (p.span ? `${p.hint} ( ${p.span.key.toUpperCase()} )` : p.hint);

const NO_BADGES: NavBadges = { inbox: 0, overdue: 0 };
const NO_HIDDEN: readonly string[] = [];

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

export function NavRail({
  today,
  areas,
  badges = NO_BADGES,
  min = false,
  hidden = NO_HIDDEN,
}: {
  today: LocalDate;
  areas: NavArea[];
  badges?: NavBadges;
  min?: boolean;
  /** The areas unticked on this device, as the layout read them from the cookie. */
  hidden?: readonly string[];
}) {
  const pathname = usePathname();
  const shown = useShownAreas(hidden);
  return (
    <>
      <PhoneHeader />
      <Rail pathname={pathname} today={today} areas={areas} badges={badges} min={min} shown={shown} />
      <PhoneBar pathname={pathname} today={today} areas={areas} badges={badges} shown={shown} />
    </>
  );
}

type ShownAreas = { hidden: readonly string[]; toggle: (id: string) => void };

/**
 * Which areas are unticked, kept in a cookie like the other display choices of this device. A tick
 * shows at once; the page is then asked again, and every view's filter reads the cookie
 * (`getFilter`), so the area's items leave or come back on whatever page is up.
 */
function useShownAreas(saved: readonly string[]): ShownAreas {
  const router = useRouter();
  const [was, setWas] = useState(saved);
  const [hidden, setHidden] = useState(saved);
  if (was !== saved) {
    setWas(saved);
    setHidden(saved);
  }
  return {
    hidden,
    toggle(id) {
      const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
      setHidden(next);
      const value = hiddenAreasValue(next);
      document.cookie = `${HIDDEN_AREAS_COOKIE}=${value}; path=/; max-age=${value ? 31536000 : 0}; samesite=lax`;
      router.refresh();
    },
  };
}

function Rail({
  pathname,
  today,
  areas,
  badges,
  min: savedMin,
  shown,
}: {
  pathname: string;
  today: LocalDate;
  areas: NavArea[];
  badges: NavBadges;
  min: boolean;
  shown: ShownAreas;
}) {
  const calendar = useCalendarLinks(today);
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
      className="group/rail sticky top-0 flex h-dvh flex-col border-r border-rule-soft bg-paper-2 pt-6 pb-4 max-rail:hidden"
    >
      {/* The panel scrolls between its head and the account row, which both stay put. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-4 pb-4 group-data-[min]/rail:px-2.5">
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
      <div className="grid gap-2">
        <CreateButton />
        <SearchField />
      </div>

      <MiniMonth
        today={today}
        anchor={calendar.view.anchor}
        from={calendar.view.from}
        to={calendar.view.to}
        hrefFor={calendar.dayHref}
        className="group-data-[min]/rail:hidden"
      />

      {areas.length > 0 && (
        <section aria-labelledby="areas-h" className="group-data-[min]/rail:hidden">
          <h2 id="areas-h" className={`mx-2 mb-1.5 ${overline}`}>
            Areas
          </h2>
          <AreaChecks areas={areas} shown={shown} />
        </section>
      )}

      <div className="grid gap-5">
        {PLACE_GROUPS.map((group) => (
          <PlaceList key={group} heading={group} places={PLACES.filter((p) => p.group === group)} pathname={pathname} today={today} badges={badges} spans={calendar.spans} />
        ))}
      </div>
      </div>

      <div className="border-t border-rule-soft px-4 pt-3 group-data-[min]/rail:px-2.5">
        <AccountMenu settingsHere={SETTINGS.here(pathname, today)} />
      </div>
    </nav>
  );
}

function PlaceList({
  heading,
  places,
  pathname,
  today,
  badges,
  spans,
}: {
  heading: string;
  places: Place[];
  pathname: string;
  today: LocalDate;
  badges: NavBadges;
  spans: Record<Span, string> | null;
}) {
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
                href={p.span && spans ? spans[p.span.is] : hrefOf(p.href)}
                title={navTitle(p)}
                aria-keyshortcuts={p.span && spans ? p.span.key : undefined}
                aria-current={here ? "page" : undefined}
                aria-describedby={badge ? `${id}-${p.id}` : undefined}
                className={`${here ? current : quiet} relative pointer-coarse:min-h-11 group-data-[min]/rail:justify-center`}
              >
                {ICONS[p.id]}
                <span className="group-data-[min]/rail:sr-only">{navName(p)}</span>
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

/**
 * The reader's areas, each with a tick that shows or hides it in every view on this device, and how
 * many items it has open today. Set smaller and lighter than the places, since it is a lens on them
 * rather than a place of its own. An address that names one area (`?area=`) still shows that area alone.
 */
function AreaChecks({ areas, shown, roomy = false }: { areas: NavArea[]; shown: ShownAreas; roomy?: boolean }) {
  return (
    <ul className={roomy ? "px-2" : "grid gap-px"}>
      {areas.map((a) => {
        const on = !shown.hidden.includes(a.id);
        return (
          <li key={a.id}>
            <label
              title={on ? `Hide ${a.name} in every view` : `Show ${a.name} in every view`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md hover:bg-hover active:bg-press ${roomy ? "min-h-12 px-3 text-[15px]" : "px-2 py-1 text-[13px] pointer-coarse:min-h-11"} ${on ? "text-ink" : "text-ink-2"}`}
            >
              <input type="checkbox" checked={on} onChange={() => shown.toggle(a.id)} className="peer sr-only" />
              {/* The box is the area's colour, as its blocks are; an area with none is drawn in ink. Ticked is filled, unticked is hollow. */}
              <span
                aria-hidden="true"
                className="inline-flex size-4 flex-none items-center justify-center rounded-[4px] border-[1.5px] text-sheet peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                style={{ borderColor: a.color ? `var(--area-${a.color})` : "var(--ink-2)", backgroundColor: on ? (a.color ? `var(--area-${a.color})` : "var(--ink-2)") : "transparent" }}
              >
                {on && (
                  <svg viewBox="0 0 12 12" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.2l2.4 2.4 4.6-5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              {a.open > 0 && (
                <span className="flex-none text-xs text-ink-3 tabular" title={`${a.open} open today`}>
                  <span aria-hidden="true">{a.open}</span>
                  <span className="sr-only">, {a.open} open today</span>
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Create, at the head of the panel: it opens capture, the way everything is made here. Where the
 * page has a capture field it goes there, as C does; anywhere else the palette captures.
 */
function CreateButton() {
  const openPalette = useOpenPalette();
  return (
    <button
      type="button"
      onClick={() => {
        const field = document.getElementById("capture");
        if (field) field.focus();
        else openPalette();
      }}
      aria-keyshortcuts={CAPTURE_KEY}
      title={`Create: capture a task, an event or a note ( ${CAPTURE_KEY.toUpperCase()} )`}
      className="press flex h-10 w-full items-center gap-2 rounded-lg bg-ink pr-1.5 pl-3 font-medium text-paper hover:opacity-90 active:opacity-80 pointer-coarse:min-h-11 group-data-[min]/rail:justify-center group-data-[min]/rail:px-0"
    >
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      <span className="flex-1 text-left group-data-[min]/rail:sr-only">Create</span>
      <kbd aria-hidden="true" className="flex-none rounded border border-paper/40 px-1.5 font-sans text-[10.5px] leading-4 font-semibold group-data-[min]/rail:hidden">
        {CAPTURE_KEY.toUpperCase()}
      </kbd>
    </button>
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
function PhoneBar({ pathname, today, areas, badges, shown }: { pathname: string; today: LocalDate; areas: NavArea[]; badges: NavBadges; shown: ShownAreas }) {
  const tabId = useId();
  const calendar = useCalendarLinks(today);
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
                href={p.span && calendar.spans ? calendar.spans[p.span.is] : hrefOf(p.href)}
                aria-current={here ? "page" : undefined}
                aria-describedby={badge ? `${tabId}-${p.id}` : undefined}
                className={here ? tabHere : tabQuiet}
              >
                {ICONS[p.id]}
                {navName(p)}
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
        <div className="mt-3 border-t border-rule-soft px-5 pt-4">
          <MiniMonth
            today={today}
            anchor={calendar.view.anchor}
            from={calendar.view.from}
            to={calendar.view.to}
            hrefFor={calendar.dayHref}
            onGo={close}
            className="mx-auto max-w-[340px]"
          />
        </div>
        {areas.length > 0 && (
          <div className="mt-3 border-t border-rule-soft pt-3">
            <h2 className={`mx-5 mb-1 ${overline}`}>Areas</h2>
            <AreaChecks areas={areas} shown={shown} roomy />
          </div>
        )}
        {PLACE_GROUPS.map((group) => {
          const places = rest.filter((p) => p.group === group);
          return (
            places.length > 0 && (
              <SheetSection key={group} heading={group}>
                {places.map((p) => (
                  <SheetPlace
                    key={p.id}
                    place={p}
                    href={p.span && calendar.spans ? calendar.spans[p.span.is] : undefined}
                    here={p.here(pathname, today)}
                    onGo={close}
                  />
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

/** A place in the More sheet: its name, and under it what the place holds. Both are its name, as both are drawn. */
function SheetPlace({ place, href, here, onGo }: { place: Place; href?: string; here: boolean; onGo: () => void }) {
  const hrefOf = usePlaceHref();
  return (
    <li>
      <Link
        href={href ?? hrefOf(place.href)}
        aria-current={here ? "page" : undefined}
        onClick={onGo}
        className={`${here ? current : quiet} ${sheetRow} py-2`}
      >
        {ICONS[place.id]}
        <span className="grid">
          <span>{navName(place)}</span>{" "}
          <span className="text-[13px] font-normal text-ink-3">
            {place.hint}
          </span>
        </span>
      </Link>
    </li>
  );
}
