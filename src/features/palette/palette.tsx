"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useClock } from "@/components/shell/clock-context";
import type { LocalDate } from "@/domain/item";
import { isTypingTarget } from "@/features/day/nav";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { planAction } from "@/features/inbox/actions";
import { searchItemsAction } from "@/features/notes/actions";
import { TYPE_WORD, type SearchRow } from "@/features/notes/model";
import { addTagAction } from "@/features/tags/actions";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { capturedLine } from "@/features/today/capture-syntax";
import type { ActionResult, CaptureResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { describeItemAction } from "./actions";
import {
  actedLine,
  actSections,
  areaSection,
  findQuery,
  findStatus,
  paletteSections,
  type Act,
  type Command,
  type Find,
  type Section,
  type Target,
} from "./model";
import { GuideBody, GuideContext, Kbd, type GuideTopic } from "./guide";
import styles from "./palette.module.css";
import { parseVisits, RECENT_KEY, remember, visitTitle, worthRemembering, type Visit } from "./recent";
import { areaShortcut, CAPTURE_KEY, globalShortcut, goShortcut, GO_KEY, GO_WINDOW_MS } from "./shortcuts";
import { areaHref } from "@/features/filter/href";


/** The writes and reads the palette makes. Server actions in the app, in-memory fakes in the dev harness. */
export type PaletteActions = {
  capture: (title: string) => Promise<CaptureResult>;
  search: (query: string) => Promise<SearchRow[]>;
  /** The item a screen has selected, by its key, or null when it names nothing. */
  describe: (key: string) => Promise<Target | null>;
  setDone: (key: string, done: boolean) => Promise<ActionResult>;
  plan: (key: string, when: "today" | "tomorrow") => Promise<ActionResult>;
  tag: (key: string, name: string) => Promise<ActionResult>;
};

const serverActions: PaletteActions = {
  capture: captureAction,
  search: searchItemsAction,
  describe: describeItemAction,
  setDone: setDoneAction,
  plan: planAction,
  tag: addTagAction,
};
const SEARCH_DELAY_MS = 180;
/** How long after a change of page its title is read, since the new title is written a beat after the address. */
const TITLE_DELAY_MS = 400;
/** What the empty palette suggests typing. */
export const EMPTY_HINT = "Try “next friday”, “nov 3”, a #tag, or a line to capture.";

function readVisits(): Visit[] {
  try {
    return parseVisits(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

/** Remembers each page this browser opens that is not a place, so the palette can offer it again. */
function useRememberVisits() {
  const pathname = usePathname();
  useEffect(() => {
    if (!worthRemembering(pathname)) return;
    const timer = window.setTimeout(() => {
      const title = visitTitle(document.title);
      if (!title) return;
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(remember(readVisits(), { href: pathname, title })));
      } catch {
        // Storage is off or full: the palette simply has nothing recent to offer.
      }
    }, TITLE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);
}

type Open = "palette" | "help" | null;

const OpenPalette = createContext<() => void>(() => {});

/** Opens search and commands, for a visible button that does what Ctrl or Cmd K does. */
export function useOpenPalette(): () => void {
  return useContext(OpenPalette);
}

const NO_TOPICS: readonly GuideTopic[] = [];

/** An area the palette and the A keys can narrow a page to, in the rail's order. */
export type PaletteArea = { id: string; name: string };

const NO_AREAS: readonly PaletteArea[] = [];

export function PaletteProvider({
  today,
  areas = NO_AREAS,
  actions = serverActions,
  children,
}: {
  today: LocalDate;
  areas?: readonly PaletteArea[];
  actions?: PaletteActions;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [topics, setTopics] = useState(NO_TOPICS);
  const router = useRouter();
  const show = useCallback((next: readonly GuideTopic[]) => {
    setTopics(next);
    return () => setTopics((current) => (current === next ? NO_TOPICS : current));
  }, []);
  const guide = useMemo(() => ({ open: () => setOpen("help"), show }), [show]);
  useRememberVisits();
  // Read by the key listener, so a refresh that brings new areas does not reattach it and drop a pending G or A.
  const areasRef = useRef(areas);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  useEffect(() => {
    let goTimer: ReturnType<typeof setTimeout> | undefined;
    let areaTimer: ReturnType<typeof setTimeout> | undefined;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const press = {
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: target !== null && isTypingTarget(target),
      };
      // G, then a place's key. Any other key ends the wait and is handled as usual.
      const step = goShortcut(goTimer !== undefined, press);
      clearTimeout(goTimer);
      goTimer = undefined;
      if (step === "wait") {
        goTimer = setTimeout(() => (goTimer = undefined), GO_WINDOW_MS);
        return;
      }
      if (step) {
        e.preventDefault();
        router.push(step.href);
        return;
      }
      // A, then a digit: the page narrowed to that area, or 0 for every area.
      const areas = areasRef.current;
      const pick = areaShortcut(areaTimer !== undefined, press, areas.length);
      clearTimeout(areaTimer);
      areaTimer = undefined;
      if (pick === "wait") {
        areaTimer = setTimeout(() => (areaTimer = undefined), GO_WINDOW_MS);
        return;
      }
      if (pick) {
        e.preventDefault();
        const id = pick.index === null ? null : areas[pick.index].id;
        router.push(areaHref(window.location.pathname, window.location.search.slice(1), id));
        return;
      }
      // C goes to the page's capture field where it has one (that field takes the key); anywhere else the palette captures.
      if (e.key === CAPTURE_KEY && !press.altKey && !press.ctrlKey && !press.metaKey && !press.typing && !e.defaultPrevented) {
        if (document.getElementById("capture") || document.querySelector("dialog[open]")) return;
        e.preventDefault();
        setOpen("palette");
        return;
      }
      const action = globalShortcut(press);
      if (!action) return;
      e.preventDefault();
      setOpen((o) => (action === "help" ? (o ?? "help") : o === "palette" ? null : "palette"));
    }
    document.addEventListener("keydown", onKey);
    // The page answers its keys from here on; browser tests wait for this before pressing any (e2e/session.ts).
    document.documentElement.dataset.hydrated = "";
    return () => {
      clearTimeout(goTimer);
      clearTimeout(areaTimer);
      document.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.hydrated;
    };
  }, [router]);

  return (
    <OpenPalette.Provider value={() => setOpen("palette")}>
      <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>
      <Modal open={open === "palette"} onClose={() => setOpen(null)} label="Search and commands">
        <PaletteBody
          today={today}
          areas={areas}
          actions={actions}
          onClose={() => setOpen(null)}
          onHelp={() => setOpen("help")}
        />
      </Modal>
      <Modal open={open === "help"} onClose={() => setOpen(null)} label="Guide" keepKeys>
        <GuideBody topics={topics} onClose={() => setOpen(null)} />
      </Modal>
    </OpenPalette.Provider>
  );
}

/**
 * A native modal dialog: focus stays inside, Escape closes it, and focus goes
 * back to whatever had it before. Its children mount only while it is open,
 * so each visit starts fresh. `keepKeys` stops single-key shortcuts behind it
 * (day stepping, capture) from acting while it is up.
 */
function Modal({
  open,
  onClose,
  label,
  keepKeys = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  keepKeys?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wanted = useRef(open);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    wanted.current = open;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open) {
      if (dialog.open) dialog.close();
      restoreFocus(opener);
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // The browser closed it (Escape), not the `open` prop. `close` alone is not
    // enough: its event is queued and can arrive late, so `cancel` reports first.
    function onBrowserClose() {
      if (wanted.current) close.current();
    }
    dialog.addEventListener("cancel", onBrowserClose);
    dialog.addEventListener("close", onBrowserClose);
    return () => {
      dialog.removeEventListener("cancel", onBrowserClose);
      dialog.removeEventListener("close", onBrowserClose);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={styles.dialog}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (keepKeys && e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      }}
    >
      {open && children}
    </dialog>
  );
}

/** The area choices go straight after the pages, before dates, capture and search. */
function withAreas(sections: Section[], areas: Section[]): Section[] {
  const at = sections.findIndex((s) => s.id === "go") + 1;
  return [...sections.slice(0, at), ...areas, ...sections.slice(at)];
}

function restoreFocus(opener: { current: HTMLElement | null }) {
  const back = opener.current;
  opener.current = null;
  if (back?.isConnected && document.activeElement !== back) back.focus({ preventScroll: true });
}

function PaletteBody({
  today,
  areas,
  actions,
  onClose,
  onHelp,
}: {
  today: LocalDate;
  areas: readonly PaletteArea[];
  actions: PaletteActions;
  onClose: () => void;
  onHelp: () => void;
}) {
  const router = useRouter();
  const clock = useClock();
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

  const sections = target
    ? actSections(input, target)
    : withAreas(paletteSections(input, today, clock, find, selected, recent), areaSection(input, areas, { pathname, query }));
  const commands = sections.flatMap((s) => s.commands);
  const current = commands.length ? Math.min(active, commands.length - 1) : -1;
  const optionId = (c: Command) => `${id}-${c.id}`;
  const activeId = current >= 0 ? optionId(commands[current]) : undefined;
  const status = note ?? findStatus(input, find) ?? (target || input.trim() ? null : EMPTY_HINT);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function type(value: string) {
    setInput(value);
    setActive(0);
    setNote(null);
    if (!target) search(value);
  }

  function search(value: string) {
    clearTimeout(timer.current);
    const q = findQuery(value);
    if (!q) return;
    setFind((f) => (f.status === "done" && f.query === q ? f : { status: "searching", query: q }));
    timer.current = setTimeout(() => {
      actions.search(q).then(
        (rows) => setFind((f) => (f.status === "searching" && f.query === q ? { status: "done", query: q, rows } : f)),
        () => setFind((f) => (f.status === "searching" && f.query === q ? { status: "failed", query: q } : f)),
      );
    }, SEARCH_DELAY_MS);
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
    const saving =
      a.do === "done" ? actions.setDone(item.key, a.done) : a.do === "plan" ? actions.plan(item.key, a.when) : actions.tag(item.key, a.name);
    saving.then(
      (result) => {
        setNote(result.ok ? actedLine(a, item.title) : result.error);
        if (!result.ok || a.do !== "done") return;
        const marked = (t: Target | null) => (t?.key === item.key ? { ...t, done: a.done } : t);
        setTarget(marked);
        setSelected(marked);
      },
      () => setNote("That change did not save. Try again."),
    );
  }

  function capture(title: string) {
    // Clear at once so the next thought can start while this one saves, as the capture field does.
    type("");
    setNote("Saving");
    actions.capture(title).then(
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
      run(commands[current]);
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
                      : (command.kind === "go" || command.kind === "help") && command.hint
                        ? `${command.label}, ${command.hint}`
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
  if ((command.kind === "go" || command.kind === "help") && command.hint) {
    const go = command.kind === "go" ? command.go : undefined;
    return (
      <>
        <span className="min-w-0 flex-none truncate text-ink">{command.label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[13px] text-ink-3">{command.hint}</span>
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
