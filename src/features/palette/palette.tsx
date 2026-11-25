"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LocalDate } from "@/domain/item";
import { isTypingTarget } from "@/features/day/nav";
import { GuideBody, GuideContext, type GuideTopic } from "./guide";
import type { PaletteActions } from "./palette-body";
import styles from "./palette.module.css";
import { forget, remember, visitTitle, worthRemembering } from "./recent";
import { changeVisits } from "./recent-store";
import { setSequencePending } from "./sequence";
import { areaShortcut, CAPTURE_KEY, globalShortcut, goShortcut, GO_WINDOW_MS } from "./shortcuts";
import { areaHref } from "@/features/filter/href";
import { loadWhenReachable } from "@/lib/reach";
import { whenIdle } from "@/lib/when-idle";

export type { PaletteActions } from "./palette-body";

/** How long after a change of page its title is read, since the new title is written a beat after the address. */
const TITLE_DELAY_MS = 400;

/**
 * The palette's list, its search and its commands, with the server actions they call: none of it is
 * needed to draw a page, so it is fetched once the page is idle, or on the first key that could open it.
 */
const loadBody = () => import("./palette-body");
type Body = Awaited<ReturnType<typeof loadBody>>["PaletteBody"];

/**
 * Remembers each page this browser opens that is not a place, so the palette can offer it again. A page that
 * says it is missing (`data-not-found`, such as a deleted tag's) is forgotten instead, so an old link does not
 * stay in Recent.
 */
function useRememberVisits() {
  const pathname = usePathname();
  useEffect(() => {
    if (!worthRemembering(pathname)) return;
    const timer = window.setTimeout(() => {
      if (document.querySelector("[data-not-found]")) {
        changeVisits((list) => forget(list, pathname));
        return;
      }
      const title = visitTitle(document.title);
      if (!title) return;
      changeVisits((list) => remember(list, { href: pathname, title }));
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
  actions,
  children,
}: {
  today: LocalDate;
  areas?: readonly PaletteArea[];
  /** Server actions when not given. */
  actions?: PaletteActions;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [topics, setTopics] = useState(NO_TOPICS);
  const [Body, setBody] = useState<Body | null>(null);
  const router = useRouter();
  const fetching = useRef(false);
  // A failure online leaves the palette closed; the next key or click tries again.
  const fetchBody = useCallback(() => {
    if (fetching.current) return;
    fetching.current = true;
    void loadWhenReachable(loadBody).then(
      (m) => setBody(() => m.PaletteBody),
      () => {
        fetching.current = false;
      },
    );
  }, []);

  useEffect(() => whenIdle(fetchBody), [fetchBody]);

  // Asked for before it arrived (a click on the rail's Search, say): it opens once it is here.
  const waiting = open === "palette" && Body === null;
  useEffect(() => {
    if (waiting) fetchBody();
  }, [waiting, fetchBody]);
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
      // Before the page went idle, a key may be the one that opens the palette: start fetching it now.
      fetchBody();
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
      setSequencePending(false);
      if (step === "wait") {
        goTimer = setTimeout(() => ((goTimer = undefined), setSequencePending(areaTimer !== undefined)), GO_WINDOW_MS);
        setSequencePending(true);
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
        areaTimer = setTimeout(() => ((areaTimer = undefined), setSequencePending(goTimer !== undefined)), GO_WINDOW_MS);
        setSequencePending(true);
        return;
      }
      if (pick) {
        e.preventDefault();
        const id = pick.index === null ? null : areas[pick.index].id;
        router.push(areaHref(window.location.pathname, window.location.search.slice(1), id));
        return;
      }
      // C goes to the page's capture field where it has one; anywhere else the palette captures.
      if (e.key === CAPTURE_KEY && !press.altKey && !press.ctrlKey && !press.metaKey && !press.typing && !e.defaultPrevented) {
        if (document.querySelector("dialog[open]")) return;
        e.preventDefault();
        const field = document.getElementById("capture");
        if (field) field.focus();
        else setOpen("palette");
        return;
      }
      const action = globalShortcut(press);
      if (!action) return;
      e.preventDefault();
      setOpen((o) => (action === "help" ? (o ?? "help") : o === "palette" ? null : "palette"));
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(goTimer);
      clearTimeout(areaTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [router, fetchBody]);

  return (
    <OpenPalette.Provider value={() => setOpen("palette")}>
      <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>
      <Modal open={open === "palette" && Body !== null} onClose={() => setOpen(null)} label="Search and commands">
        {Body && (
          <Body today={today} areas={areas} actions={actions} onClose={() => setOpen(null)} onHelp={() => setOpen("help")} />
        )}
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


function restoreFocus(opener: { current: HTMLElement | null }) {
  const back = opener.current;
  opener.current = null;
  if (back?.isConnected && document.activeElement !== back) back.focus({ preventScroll: true });
}
