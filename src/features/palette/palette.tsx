"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { LocalDate } from "@/domain/item";
import { isTypingTarget } from "@/features/day/nav";
import { searchItemsAction } from "@/features/notes/actions";
import { TYPE_WORD, type SearchRow } from "@/features/notes/model";
import { captureAction } from "@/features/today/actions";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { findQuery, findStatus, paletteSections, type Command, type Find } from "./model";
import styles from "./palette.module.css";
import { chordCaps, chordSpoken, globalShortcut, SHORTCUTS, type Chord } from "./shortcuts";

/** The writes and reads the palette makes. Server actions in the app, in-memory fakes in the dev harness. */
export type PaletteActions = {
  capture: (title: string) => Promise<ActionResult>;
  search: (query: string) => Promise<SearchRow[]>;
};

const serverActions: PaletteActions = { capture: captureAction, search: searchItemsAction };
const SEARCH_DELAY_MS = 180;

type Open = "palette" | "help" | null;

const OpenPalette = createContext<() => void>(() => {});

/** Opens search and commands, for a visible button that does what Ctrl or Cmd K does. */
export function useOpenPalette(): () => void {
  return useContext(OpenPalette);
}

const subscribeNothing = () => () => {};

/** True on Apple platforms, where the shortcut is Cmd. False while rendering on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function PaletteProvider({
  today,
  actions = serverActions,
  children,
}: {
  today: LocalDate;
  actions?: PaletteActions;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const action = globalShortcut({
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: target !== null && isTypingTarget(target),
      });
      if (!action) return;
      e.preventDefault();
      setOpen((o) => (action === "help" ? (o ?? "help") : o === "palette" ? null : "palette"));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OpenPalette.Provider value={() => setOpen("palette")}>
      {children}
      <Modal open={open === "palette"} onClose={() => setOpen(null)} label="Search and commands">
        <PaletteBody
          today={today}
          actions={actions}
          onClose={() => setOpen(null)}
          onHelp={() => setOpen("help")}
        />
      </Modal>
      <Modal open={open === "help"} onClose={() => setOpen(null)} label="Keyboard shortcuts" keepKeys>
        <ShortcutsBody onClose={() => setOpen(null)} />
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

function restoreFocus(opener: { current: HTMLElement | null }) {
  const back = opener.current;
  opener.current = null;
  if (back?.isConnected && document.activeElement !== back) back.focus({ preventScroll: true });
}

function PaletteBody({
  today,
  actions,
  onClose,
  onHelp,
}: {
  today: LocalDate;
  actions: PaletteActions;
  onClose: () => void;
  onHelp: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [input, setInput] = useState("");
  const [find, setFind] = useState<Find>({ status: "idle" });
  const [active, setActive] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const sections = paletteSections(input, today, find);
  const commands = sections.flatMap((s) => s.commands);
  const current = commands.length ? Math.min(active, commands.length - 1) : -1;
  const optionId = (c: Command) => `${id}-${c.id}`;
  const activeId = current >= 0 ? optionId(commands[current]) : undefined;
  const status = note ?? findStatus(input, find);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function type(value: string) {
    setInput(value);
    setActive(0);
    setNote(null);
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
      default:
        router.push(command.href);
        onClose();
    }
  }

  function capture(title: string) {
    // Clear at once so the next thought can start while this one saves, as the capture field does.
    type("");
    setNote("Saving");
    actions.capture(title).then(
      (result) => {
        if (result.ok) {
          setNote(`Captured “${title}”. It is waiting for a time on Today.`);
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
    if (e.nativeEvent.isComposing || commands.length === 0) return;
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
          aria-label="Search, go to a page or date, or capture"
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
          placeholder="Search, go to a date, or capture"
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
                  aria-label={command.kind === "open" ? `${command.label}, ${TYPE_WORD[command.type]}${command.done ? ", done" : ""}` : undefined}
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
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to choose, <Kbd>Enter</Kbd> to run, <Kbd>Esc</Kbd> to close
        </p>
      </div>
    </>
  );
}

function CommandLine({ command }: { command: Command }) {
  if (command.kind !== "open") return <span className="min-w-0 truncate text-ink">{command.label}</span>;
  return (
    <>
      <span className="grid min-w-0 flex-1">
        <span className={`truncate text-ink ${command.done ? "line-through decoration-ink-3" : ""}`}>{command.label}</span>
        {command.detail && <span className="truncate text-[13px] text-ink-2">{command.detail}</span>}
      </span>
      <span className="flex-none text-[13px] text-ink-3">
        {TYPE_WORD[command.type]}
        {command.done && ", done"}
      </span>
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-2">{children}</kbd>;
}

function ChordKeys({ chord, mac }: { chord: Chord; mac: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {chordCaps(chord, mac).map((cap) => (
        <Kbd key={cap}>{cap}</Kbd>
      ))}
    </span>
  );
}

function ShortcutsBody({ onClose }: { onClose: () => void }) {
  const mac = useIsMac();
  const id = useId();
  return (
    <>
      <div className="flex items-center gap-3 border-b border-rule-soft px-5 py-3.5">
        <h2 id={`${id}-h`} className="font-serif text-lg font-semibold">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="ml-auto rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-accent-wash hover:text-ink"
        >
          Close
        </button>
      </div>
      <div className={`${styles.scroll} px-5 pt-2 pb-5`}>
        {SHORTCUTS.map((group) => (
          <section key={group.where} aria-labelledby={`${id}-${group.where}`} className="mt-4">
            <h3 id={`${id}-${group.where}`} className="mb-1.5 text-xs font-semibold text-ink-3">
              {group.where}
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 min-[480px]:grid-cols-[11.5rem_minmax(0,1fr)] min-[480px]:gap-y-2">
              {group.shortcuts.map((s) => (
                <div key={`${s.handler}-${s.does}`} className="contents">
                  <dt className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 min-[480px]:mb-0">
                    <span className="sr-only">{s.chords.map((c) => chordSpoken(c, mac)).join(" or ")}</span>
                    {s.chords.map((chord, i) => (
                      <span key={i} aria-hidden="true" className="inline-flex items-center gap-1.5">
                        {i > 0 && <span className="text-ink-3">or</span>}
                        <ChordKeys chord={chord} mac={mac} />
                      </span>
                    ))}
                  </dt>
                  <dd className="mb-2.5 text-ink-2 min-[480px]:mb-0">{s.does}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
