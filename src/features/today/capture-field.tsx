"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useClock } from "@/components/shell/clock-context";
import { useWeekStart } from "@/components/shell/week-start-context";
import { useAreas } from "@/components/shell/areas-context";
import { captureAction as serverCapture, captureLinesAction, captureListAction } from "./actions";
import { oneLine, pastedLines, shortName } from "./capture-paste";
import type { ActionResult, CaptureResult } from "./commands";
import {
  CAPTURE_EXAMPLES,
  CAPTURE_LEAD,
  capturedLine,
  firstCapturedLine,
  momentHere,
  parseCapture,
  previewWords,
  type CaptureArea,
  type Moment,
} from "./capture-syntax";
import { CAPTURE_PARAM, readPrefill } from "./capture-prefill";
import { TITLE_MAX } from "./model";
import { useQueueCapture } from "@/components/shell/outbox";
import { reach, UNREACHABLE } from "@/lib/reach";

/** How long a new item wears the accent ring once it shows up. */
const MARK_MS = 2400;
/** How long to wait for the new item to render before giving up on marking it. */
const LOOK_MS = 4000;

/**
 * Rings the element that draws item `id` once it appears: a Score beam or chip
 * and a Week chip carry `data-item`, an Inbox row's title carries `data-open`.
 * The page is not scrolled, so the field stays put for the next thought.
 * Returns a function that stops looking and takes the ring off.
 */
function markWhenShown(id: string): () => void {
  const selector = `[data-item="${CSS.escape(id)}"], [data-open="${CSS.escape(id)}"]`;
  const giveUp = Date.now() + LOOK_MS;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let marked: Element | null = null;
  const look = () => {
    marked = document.querySelector(selector);
    if (marked) {
      marked.setAttribute("data-captured", "");
      timer = setTimeout(() => marked?.removeAttribute("data-captured"), MARK_MS);
    } else if (Date.now() < giveUp) {
      frame = requestAnimationFrame(look);
    }
  };
  look();
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    marked?.removeAttribute("data-captured");
  };
}

/** How long each first-day example stays in the placeholder. */
const EXAMPLE_MS = 3500;

/** The first-day placeholder: each capture example in turn, or the first one only when motion is reduced. */
function useExample(on: boolean): string {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setAt((i) => (i + 1) % CAPTURE_EXAMPLES.length), EXAMPLE_MS);
    return () => window.clearInterval(id);
  }, [on]);
  return CAPTURE_EXAMPLES[on ? at : 0];
}

type Status = { text: string; error: boolean; link?: { href: string; label: string } };

/** What a pasted block of lines may become: one task a line, or a checklist named by the first line with the rest as its lines. */
export type PasteActions = {
  items: (lines: string[]) => Promise<CaptureResult | ActionResult>;
  list: (lines: string[]) => Promise<CaptureResult | ActionResult>;
};

const serverPaste: PasteActions = { items: captureLinesAction, list: captureListAction };

const OFFER_BUTTON =
  "press rounded border border-rule px-2 py-0.5 font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:px-3 pointer-coarse:py-2";

export function CaptureField({
  captureAction = serverCapture,
  pasteActions,
  label = "Capture anything",
  placeholder = "Capture",
  plans = true,
  firstDay = false,
  screenStatus,
  inline = false,
}: {
  // Some screens still type their capture as a plain ActionResult; the server sends the full CaptureResult.
  captureAction?: (title: string) => Promise<CaptureResult | ActionResult>;
  /** What a pasted block of lines is offered as. The app's own capture gets the app's own; a screen with another capture offers nothing unless it says. */
  pasteActions?: PasteActions;
  label?: string;
  placeholder?: string;
  /** False where the capture takes its words as a name and plans nothing, so no preview shows. */
  plans?: boolean;
  /** The account has never stored an item: lead with a line of help, show examples, and answer the first capture in full. */
  firstDay?: boolean;
  /**
   * The screen's own status line (a move, a tick, a plan). It shares this field's status line, so the
   * page reserves one line of room for news under the field, not two.
   */
  screenStatus?: ReactNode;
  /** In a calendar view's one-row head (wide): fill the room, and lay the status under the field without taking row height. */
  inline?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();
  const [value, setValue] = useState(() => readPrefill(params.get(CAPTURE_PARAM) ?? undefined) ?? "");
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const unmark = useRef<() => void>(() => {});
  const clock = useClock();
  const weekStart = useWeekStart();
  // Read when a key is pressed, not while rendering: a repeat whose time today has passed says the day it starts.
  const [moment, setMoment] = useState<Moment | undefined>(undefined);
  const areas = useAreas() as readonly CaptureArea[] | undefined;
  const preview = plans ? previewWords(parseCapture(value, { weekStart, areas }), clock, moment) : null;
  const paste = pasteActions ?? (captureAction === serverCapture ? serverPaste : undefined);
  // The lines of a block just pasted, while the choice of what to make of them stands. Any typing withdraws it.
  const [pasted, setPasted] = useState<string[] | null>(null);
  const example = useExample(firstDay);
  const pathname = usePathname();
  const queue = useQueueCapture();

  useEffect(() => () => unmark.current(), []);

  // Words from the home-screen shortcut or the share menu arrive as ?capture=. They fill the field, never save, and leave the address.
  const router = useRouter();
  const handed = params.get(CAPTURE_PARAM);
  useEffect(() => {
    if (handed === null) return;
    input.current?.focus();
    const rest = new URLSearchParams(params.toString());
    rest.delete(CAPTURE_PARAM);
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handed]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    // Clear at once so the next thought can start while this one saves.
    setValue("");
    setStatus(null);
    setPasted(null);
    unmark.current();
    // The answer lands after a refresh that ends the first day, so remember whether this was it.
    const first = firstDay;
    startTransition(async () => {
      const result = await reach(captureAction(title));
      if (!result.ok && result.error === UNREACHABLE && captureAction === serverCapture && queue) {
        // No connection: keep the words on this device and send them when it returns (ADR-0002).
        const queued = queue(title);
        if (queued.ok) {
          setStatus({ text: "Saved on this device. It will be sent when you are back online.", error: false });
          return;
        }
        setValue((current) => current || title);
        setStatus({ text: queued.error, error: true });
        return;
      }
      if (!result.ok) {
        setValue((current) => current || title);
        setStatus({ text: result.error, error: true });
        return;
      }
      if ("id" in result) {
        setStatus(first ? { ...firstCapturedLine(result, clock), error: false } : { text: capturedLine(result, "field", clock), error: false });
        unmark.current = markWhenShown(result.id);
      }
    });
  }

  /** Makes the pasted lines into items or a checklist. The field keeps the words until they have saved. */
  function addPasted(make: PasteActions["items"], lines: string[]) {
    const kept = value;
    setPasted(null);
    setValue("");
    setStatus(null);
    unmark.current();
    startTransition(async () => {
      const result = await reach(make(lines));
      if (!result.ok) {
        setValue((current) => current || kept);
        setStatus({ text: result.error, error: true });
        return;
      }
      if ("id" in result) {
        setStatus({ text: capturedLine(result, "field", clock), error: false });
        unmark.current = markWhenShown(result.id);
      }
      input.current?.focus();
    });
  }

  return (
    <form onSubmit={submit} autoComplete="off" className={`max-w-[440px] ${inline ? "@min-[90rem]/page:relative @min-[90rem]/page:max-w-none" : ""}`}>
      <label htmlFor="capture" className="sr-only">
        {label}
      </label>
      {firstDay && (
        <p id="capture-lead" className="mb-2 text-[15px] text-ink-2">
          {CAPTURE_LEAD}
        </p>
      )}
      <div className="relative">
        <input
          ref={input}
          id="capture"
          name="title"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMoment(momentHere());
            setPasted(null);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const lines = plans && paste ? pastedLines(text) : null;
            if (!lines) return;
            // The block goes in as the one line a plain paste makes of it, and the choice is offered under the field.
            e.preventDefault();
            const { selectionStart, selectionEnd } = e.currentTarget;
            const next = `${value.slice(0, selectionStart ?? value.length)}${oneLine(text)}${value.slice(selectionEnd ?? value.length)}`.slice(0, TITLE_MAX);
            setValue(next);
            setMoment(momentHere());
            setPasted(lines);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            // The first Escape withdraws a paste's offer; the next leaves the field.
            if (pasted) setPasted(null);
            else e.currentTarget.blur();
          }}
          maxLength={TITLE_MAX}
          placeholder={firstDay ? example : placeholder}
          aria-keyshortcuts="c"
          aria-describedby={`${firstDay ? "capture-lead " : ""}capture-status capture-preview${pasted ? " capture-pasted" : ""}`}
          className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-10 pl-3.5 text-ink"
        />
        <kbd
          aria-hidden="true"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-3 pointer-coarse:hidden"
        >
          C
        </kbd>
      </div>
      <div className={`mt-1.5 ${inline ? "@min-[90rem]/page:absolute @min-[90rem]/page:inset-x-0 @min-[90rem]/page:top-full @min-[90rem]/page:z-[1] @min-[90rem]/page:mt-0" : ""}`}>
        <div className="min-h-6 min-w-0 pt-0.5 text-[13px]">
          {/* While the line reads as a plan, the preview takes the status line's place; the status stays for screen readers. */}
          <p id="capture-status" role="status" className={preview || pasted ? "sr-only" : status?.error ? "font-medium text-ink" : "text-ink-2"}>
            {pending ? "Saving" : status?.text}
            {!pending && status?.link && status.link.href !== pathname && (
              <>
                {" "}
                <Link href={status.link.href} className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
                  {status.link.label}
                </Link>
                .
              </>
            )}
          </p>
          {pasted && paste && (
            <div role="group" aria-labelledby="capture-pasted" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pb-1 text-ink-2">
              <p id="capture-pasted">You pasted {pasted.length} lines.</p>
              <button type="button" className={OFFER_BUTTON} onClick={() => addPasted(paste.items, pasted)}>
                Add {pasted.length} items
              </button>
              <button type="button" className={OFFER_BUTTON} onClick={() => addPasted(paste.list, pasted)}>
                Add as a checklist named “{shortName(pasted[0])}”
              </button>
              <span>or press Enter to keep one line.</span>
            </div>
          )}
          {preview && !pasted && (
            <p id="capture-preview" className="text-ink-2">
              <span className="sr-only">Understood: </span>
              <span className="rounded border border-rule px-1.5 py-px">{preview}</span>
            </p>
          )}
          {screenStatus}
        </div>
      </div>
    </form>
  );
}
