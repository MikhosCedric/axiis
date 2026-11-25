"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useClock } from "@/components/shell/clock-context";
import { useWeekStart } from "@/components/shell/week-start-context";
import type { LocalDate } from "@/domain/item";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { tellNews } from "@/components/news-bus";
import {
  DESKTOP_COOKIE,
  readDensity,
  readReminders,
  readTheme,
  REMINDERS_COOKIE,
  weekStartSetting,
} from "@/components/shell/cookies";
import { saveDensity, saveReminders, saveWeekStart } from "@/components/shell/prefs";
import { applyTheme } from "@/components/shell/theme-toggle";
import type { WeekStart } from "@/features/week/week-of";
import { moveRows, restNews, type RestItem } from "@/features/day/rest-of-day";
import { restoreOccurrenceAction, setTypeAction, unplanAction, deleteItemAction } from "@/features/detail/actions";
import type { DeleteResult } from "@/features/detail/commands";
import { duplicateItemAction, restoreItemsAction } from "@/features/actions/actions";
import type { DuplicateResult } from "@/features/actions/commands";
import { planAction } from "@/features/inbox/actions";
import { planDate, type PlanFor } from "@/features/inbox/model";
import { searchItemsAction } from "@/features/notes/actions";
import { TYPE_WORD, type SearchRow } from "@/features/notes/model";
import { addTagAction } from "@/features/tags/actions";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { filteredArea, withDefaultArea } from "@/features/today/capture-area";
import { capturedLine } from "@/features/today/capture-syntax";
import type { ActionResult, CaptureResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { describeItemAction, restOfTodayAction } from "./actions";
import {
  actedLine,
  actSections,
  areaSection,
  commandSections,
  findQuery,
  findStatus,
  leadsWithMatch,
  paletteSections,
  planDay,
  sameTitle,
  type Act,
  type Command,
  type DisplayNow,
  type Find,
  type Run,
  type Section,
  type Setting,
  type Target,
} from "./model";
import { Kbd } from "./guide";
import styles from "./palette.module.css";
import type { PaletteArea } from "./palette";
import { readVisits } from "./recent-store";
import { GO_KEY } from "./shortcuts";

/** The writes and reads the palette makes. Server actions in the app, in-memory fakes in the dev harness. */
export type PaletteActions = {
  capture: (title: string) => Promise<CaptureResult>;
  search: (query: string) => Promise<SearchRow[]>;
  /** The item a screen has selected, by its key, or null when it names nothing. */
  describe: (key: string) => Promise<Target | null>;
  setDone: (key: string, done: boolean) => Promise<ActionResult>;
  plan: (key: string, when: PlanFor) => Promise<ActionResult>;
  unplan: (key: string) => Promise<ActionResult>;
  tag: (key: string, name: string) => Promise<ActionResult>;
  duplicate: (key: string) => Promise<DuplicateResult>;
  setType: (key: string, type: "event" | "task") => Promise<ActionResult>;
  remove: (key: string, scope: "one" | "all") => Promise<DeleteResult>;
  /** Undoes a delete: brings back what it took, or the skipped time it names. */
  restore: (ids: string[]) => Promise<ActionResult>;
  unskip: (key: string) => Promise<ActionResult>;
  /** What is still to do today, which the rest-of-today command moves to tomorrow. */
  restOfToday: () => Promise<RestItem[]>;
};

const serverActions: PaletteActions = {
  capture: captureAction,
  search: searchItemsAction,
  describe: describeItemAction,
  setDone: setDoneAction,
  plan: planAction,
  unplan: unplanAction,
  tag: addTagAction,
  duplicate: duplicateItemAction,
  setType: setTypeAction,
  remove: deleteItemAction,
  restore: restoreItemsAction,
  unskip: restoreOccurrenceAction,
  restOfToday: restOfTodayAction,
};
const SEARCH_DELAY_MS = 180;
/** What the empty palette suggests typing. */
const EMPTY_HINT = "Try “next friday”, “nov 3”, a #tag, or a line to capture.";

/** The area choices go straight after the pages (and an item named exactly what was typed), before dates, capture and search. */
function withAreas(sections: Section[], areas: Section[]): Section[] {
  const go = sections.findIndex((s) => s.id === "go");
  const at = go >= 0 ? go + 1 : leadsWithMatch(sections) ? 1 : 0;
  return [...sections.slice(0, at), ...areas, ...sections.slice(at)];
}

const cookieOf = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

/** The display switches as this device has them now. Reminders are the desktop app's, so they are null in a browser. */
function readDisplay(weekStart: WeekStart): DisplayNow {
  const root = document.documentElement.dataset;
  return {
    density: readDensity(root.density),
    theme: readTheme(root.theme),
    weekStart: weekStartSetting(weekStart),
    reminders: cookieOf(DESKTOP_COOKIE) ? readReminders(cookieOf(REMINDERS_COOKIE)) : null,
  };
}

/** The palette's search and commands, split from `palette.tsx` so a page loads it only once idle or asked for. */
export function PaletteBody({
  today,
  areas,
  actions = serverActions,
  onClose,
  onHelp,
}: {
  today: LocalDate;
  areas: readonly PaletteArea[];
  actions?: PaletteActions;
  onClose: () => void;
  onHelp: () => void;
}) {
  const router = useRouter();
  const clock = useClock();
  const weekStart = useWeekStart();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const id = useId();
  const [input, setInput] = useState("");
  const [find, setFind] = useState<Find>({ status: "idle" });
  const [active, setActive] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  // The item whose actions are listed; null while searching.
  const [target, setTarget] = useState<Target | null>(null);
  // Read once as the palette opens; the page it is opened on is not offered back.
  const [recent] = useState(() => readVisits().filter((v) => v.href !== window.location.pathname));
  const searched = useRef("");
  // Words whose capture waits on the search still out for them; see `settle`.
  const held = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get(SELECTED_ITEM_PARAM);
    if (!key) return;
    let live = true;
    actions.describe(key).then(
      (found) => live && setSelected(found),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [actions]);

  const [display, setDisplay] = useState(() => readDisplay(weekStart));
  const sections = target
    ? actSections(input, target)
    : withAreas(
        withAreas(paletteSections(input, today, clock, find, selected, recent, weekStart, areas), commandSections(input, display)),
        areaSection(input, areas, { pathname, query }),
      );
  const commands = sections.flatMap((s) => s.commands);
  const current = commands.length ? Math.min(active, commands.length - 1) : -1;
  const optionId = (c: Command) => `${id}-${c.id}`;
  const activeId = current >= 0 ? optionId(commands[current]) : undefined;
  const status = note ?? findStatus(input, find) ?? (target || input.trim() ? null : EMPTY_HINT);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function type(value: string) {
    held.current = null;
    setInput(value);
    setActive(0);
    setNote(null);
    if (!target) search(value);
  }

  function search(value: string, now = false) {
    clearTimeout(timer.current);
    const q = findQuery(value);
    if (!q) return;
    setFind((f) => (f.status === "done" && f.query === q ? f : { status: "searching", query: q }));
    timer.current = setTimeout(
      () => {
        actions.search(q).then(
          (rows) => {
            setFind((f) => (f.status === "searching" && f.query === q ? { status: "done", query: q, rows } : f));
            settle(q, rows);
          },
          () => {
            setFind((f) => (f.status === "searching" && f.query === q ? { status: "failed", query: q } : f));
            settle(q, []);
          },
        );
      },
      now ? 0 : SEARCH_DELAY_MS,
    );
  }

  /**
   * Enter on Capture while search is still out for those words waits for it.
   * When an item is already named what was typed, it is offered first instead
   * of saving a copy; otherwise the words are captured as asked.
   */
  function settle(q: string, rows: readonly SearchRow[]) {
    const words = held.current;
    if (words === null || findQuery(words) !== q) return;
    held.current = null;
    const same = rows.find((r) => sameTitle(r.title, words));
    if (!same) {
      capture(words);
      return;
    }
    setActive(0);
    setNote(`“${same.title}” is already here, so Enter opens it. Choose Capture to add another.`);
  }

  function run(command: Command) {
    switch (command.kind) {
      case "help":
        onHelp();
        return;
      case "capture":
        capture(command.title);
        return;
      case "open":
        enter(command.target);
        return;
      case "act":
        act(command.act);
        return;
      case "run":
        runCommand(command.run);
        return;
      default:
        router.push(command.href);
        onClose();
    }
  }

  /** Lists what can be done to an item. Escape, or Backspace in an empty field, goes back to the search. */
  function enter(next: Target) {
    searched.current = input;
    setTarget(next);
    setInput("");
    setActive(0);
    setNote(null);
  }

  function leave() {
    setTarget(null);
    setInput(searched.current);
    setActive(0);
    setNote(null);
    // Ask again, so a result shows what was just done to it.
    setFind({ status: "idle" });
    search(searched.current);
  }

  function act(a: Act) {
    if (a.do === "open") {
      router.push(a.href);
      onClose();
      return;
    }
    if (a.do === "ask-tag") {
      setInput("#");
      setActive(0);
      return;
    }
    const item = target;
    if (!item) return;
    setInput("");
    setActive(0);
    setNote("Saving");
    const failed = () => setNote("That change did not save. Try again.");
    if (a.do === "delete") {
      actions.remove(item.key, a.scope).then((result) => (result.ok ? deleted(item, a.scope, result) : setNote(result.error)), failed);
      return;
    }
    const day = a.do === "plan" ? planDate(planDay(a.when, today, weekStart), today) : null;
    const saving: Promise<ActionResult> =
      a.do === "done"
        ? actions.setDone(item.key, a.done)
        : a.do === "plan"
          ? actions.plan(item.key, planDay(a.when, today, weekStart))
          : a.do === "inbox"
            ? actions.unplan(item.key)
            : a.do === "duplicate"
              ? copy(item.key, a.tomorrow)
              : a.do === "type"
                ? actions.setType(item.key, a.type)
                : actions.tag(item.key, a.name);
    saving.then((result) => {
      setNote(result.ok ? actedLine(a, item.title) : result.error);
      if (!result.ok) return;
      // What the item is now, so the list offers what still makes sense (no second Move to Inbox).
      const now = (t: Target | null): Target | null => {
        if (t?.key !== item.key) return t;
        const quick = t.quick;
        if (a.do === "done") return { ...t, done: a.done, quick: quick && { ...quick, done: a.done } };
        if (a.do === "plan") return { ...t, quick: quick && { ...quick, day } };
        if (a.do === "inbox") return { ...t, quick: quick && { ...quick, day: null, time: null } };
        if (a.do === "type") return { ...t, type: a.type, quick: quick && { ...quick, type: a.type } };
        return t;
      };
      setTarget(now);
      setSelected(now);
    }, failed);
  }

  /** A copy of the item, planned for tomorrow when asked. */
  async function copy(key: string, tomorrow: boolean): Promise<ActionResult> {
    const made = await actions.duplicate(key);
    return made.ok && tomorrow ? actions.plan(made.id, "tomorrow") : made;
  }

  /** The item is gone: its news and Undo go to the quick actions' note, as for a row, and the palette steps aside to show it. */
  function deleted(item: Target, scope: "one" | "all", result: Extract<DeleteResult, { ok: true }>) {
    const news = result.skipped ? `“${item.title}” is skipped on this day.` : actedLine({ do: "delete", scope }, item.title);
    const undo = () =>
      void (result.skipped ? actions.unskip(result.skipped) : actions.restore(result.deleted)).then(
        (back) => tellNews(back.ok ? `“${item.title}” is back.` : back.error),
        () => tellNews("That change did not save. Try again."),
      );
    if (tellNews(news, undo)) onClose();
    else setNote(news);
  }

  /** The commands that are about no item: a display switch, or the rest of today. */
  function runCommand(r: Run) {
    setInput("");
    setActive(0);
    if (r.do === "set") {
      setting(r.setting);
      return;
    }
    setNote("Saving");
    const failed = () => setNote("That change did not save. Try again.");
    actions.restOfToday().then(async (rows) => {
      if (rows.length === 0) {
        setNote("Nothing is left to plan for tomorrow.");
        return;
      }
      const moved = await moveRows(actions.plan, rows, "tomorrow");
      const news = restNews(moved.length, rows.length - moved.length);
      const undo = moved.length
        ? () =>
            void moveRows(actions.plan, moved, "today").then(
              (back) => tellNews(back.length === moved.length ? "Back on today." : "Some of those did not move back. Try again."),
              () => tellNews("That change did not save. Try again."),
            )
        : undefined;
      if (tellNews(news, undo)) onClose();
      else setNote(news);
    }, failed);
  }

  /** A display switch, kept on this device the way Settings keeps it. The Week and the Month are drawn from the cookie, so the page is drawn again. */
  function setting(s: Setting) {
    switch (s.name) {
      case "density":
        saveDensity(s.value);
        setNote(`Density is ${s.value}.`);
        break;
      case "theme":
        applyTheme(s.value);
        setNote(`Theme is ${s.value === "system" ? "the system's" : s.value}.`);
        break;
      case "week-start":
        saveWeekStart(s.value);
        setNote(`The week starts on ${s.value === "monday" ? "Monday" : "Sunday"}.`);
        router.refresh();
        break;
      case "reminders":
        saveReminders(s.value);
        setNote(s.value ? "Reminders are on." : "Reminders are off.");
        router.refresh();
        break;
    }
    setDisplay((d) => ({ ...d, [s.name === "week-start" ? "weekStart" : s.name]: s.value }) as DisplayNow);
  }

  function capture(title: string) {
    // Clear at once so the next thought can start while this one saves, as the capture field does.
    type("");
    setNote("Saving");
    // Narrowed to one area, a capture lands in it unless the words name another.
    const said = withDefaultArea(title, filteredArea(query, areas), areas);
    actions.capture(said).then(
      (result) => {
        if (result.ok) {
          setNote(capturedLine(result, "palette", clock));
          return;
        }
        setInput((value) => value || title);
        setNote(result.error);
      },
      () => {
        setInput((value) => value || title);
        setNote("That did not save. Your words are still here, so try again.");
      },
    );
  }

  function keyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (target && (e.key === "Escape" || (e.key === "Backspace" && input === ""))) {
      // Stops the dialog closing, so Escape steps back out of the item first.
      e.preventDefault();
      leave();
      return;
    }
    if (commands.length === 0) return;
    const last = commands.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" && current >= 0) {
      e.preventDefault();
      const command = commands[current];
      if (command.kind === "capture" && find.status === "searching" && find.query === findQuery(input)) {
        if (held.current !== null) return;
        held.current = input;
        setNote("Checking for one already here");
        search(input, true);
        return;
      }
      run(command);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-rule-soft px-4">
        <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" className="flex-none text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="8" cy="8" r="4.6" />
          <path d="M11.5 11.5L15.5 15.5" />
        </svg>
        <input
          autoFocus
          role="combobox"
          aria-label={
            target ? `Actions for ${target.title}. Type # and a name to tag it.` : "Search, go to a page or date, or capture"
          }
          aria-expanded={commands.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={`${id}-status`}
          value={input}
          maxLength={TITLE_MAX}
          onChange={(e) => type(e.target.value)}
          onKeyDown={keyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder={target ? "Choose an action, or type # and a tag" : "Search, go to a date, or capture"}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none"
        />
      </div>

      <div id={`${id}-list`} role="listbox" aria-label="Commands" className={`${styles.scroll} px-2 py-2`}>
        {sections.map((section) => (
          <div key={section.id} role="group" aria-labelledby={`${id}-${section.id}`} className="mb-1 last:mb-0">
            <div id={`${id}-${section.id}`} role="presentation" className="px-2 pt-2 pb-1 text-xs font-semibold text-ink-3">
              {section.label}
            </div>
            {section.commands.map((command) => {
              const i = commands.indexOf(command);
              return (
                <div
                  key={command.id}
                  id={optionId(command)}
                  role="option"
                  aria-selected={i === current}
                  aria-label={
                    command.kind === "open"
                      ? `${command.label}, ${TYPE_WORD[command.target.type]}${command.target.done ? ", done" : ""}`
                      : undefined
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => run(command)}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 aria-selected:bg-accent-wash"
                >
                  <CommandLine command={command} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 border-t border-rule-soft px-4 py-2 text-[13px] text-ink-2">
        <p id={`${id}-status`} role="status" className="min-h-5 min-w-0 flex-1 truncate">
          {status}
        </p>
        <p aria-hidden="true" className="flex-none text-ink-3 max-rail:hidden">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to choose, <Kbd>Enter</Kbd> to run, <Kbd>Esc</Kbd> {target ? "to go back" : "to close"}
        </p>
      </div>
    </>
  );
}

function CommandLine({ command }: { command: Command }) {
  if (command.kind === "go" || command.kind === "help") {
    const go = command.kind === "go" ? command.go : undefined;
    return (
      <>
        <span className="min-w-0 flex-1 truncate text-ink">{command.label}</span>
        <span aria-hidden="true" className="flex w-12 flex-none justify-end gap-1 text-ink-3 max-rail:hidden">
          {go && (
            <>
              <Kbd>{GO_KEY.toUpperCase()}</Kbd>
              <Kbd>{go.toUpperCase()}</Kbd>
            </>
          )}
        </span>
      </>
    );
  }
  if (command.kind !== "open") return <span className="min-w-0 truncate text-ink">{command.label}</span>;
  const { type, done } = command.target;
  return (
    <>
      <span className="grid min-w-0 flex-1">
        <span className={`truncate text-ink ${done ? "line-through decoration-ink-3" : ""}`}>{command.label}</span>
        {command.detail && <span className="truncate text-[13px] text-ink-2">{command.detail}</span>}
      </span>
      <span className="flex-none text-[13px] text-ink-3">
        {TYPE_WORD[type]}
        {done && ", done"}
      </span>
    </>
  );
}
