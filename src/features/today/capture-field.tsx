"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { captureAction as serverCapture } from "./actions";
import type { ActionResult, CaptureResult } from "./commands";
import { CAPTURE_EXAMPLES, CAPTURE_LEAD, capturedLine, firstCapturedLine, parseCapture, previewWords } from "./capture-syntax";
import { TITLE_MAX } from "./model";

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

export function CaptureField({
  captureAction = serverCapture,
  label = "Capture anything",
  placeholder = "Capture anything, then place it later",
  plans = true,
  firstDay = false,
  screenStatus,
}: {
  // Some screens still type their capture as a plain ActionResult; the server sends the full CaptureResult.
  captureAction?: (title: string) => Promise<CaptureResult | ActionResult>;
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
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const unmark = useRef<() => void>(() => {});
  const preview = plans ? previewWords(parseCapture(value)) : null;
  const example = useExample(firstDay);
  const pathname = usePathname();

  useEffect(() => () => unmark.current(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        return;
      }
      e.preventDefault();
      input.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    // Clear at once so the next thought can start while this one saves.
    setValue("");
    setStatus(null);
    unmark.current();
    // The answer lands after a refresh that ends the first day, so remember whether this was it.
    const first = firstDay;
    startTransition(async () => {
      const result = await captureAction(title);
      if (!result.ok) {
        setValue((current) => current || title);
        setStatus({ text: result.error, error: true });
        return;
      }
      if ("id" in result) {
        setStatus(first ? { ...firstCapturedLine(result), error: false } : { text: capturedLine(result, "field"), error: false });
        unmark.current = markWhenShown(result.id);
      }
    });
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="max-w-[440px]">
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
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          maxLength={TITLE_MAX}
          placeholder={firstDay ? example : placeholder}
          aria-keyshortcuts="c"
          aria-describedby={`${firstDay ? "capture-lead " : ""}capture-status capture-preview`}
          className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-10 pl-3.5 text-ink"
        />
        <kbd
          aria-hidden="true"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-3 pointer-coarse:hidden"
        >
          C
        </kbd>
      </div>
      <div className="mt-1.5">
        <div className="min-h-6 min-w-0 pt-0.5 text-[13px]">
          {/* While the line reads as a plan, the preview takes the status line's place; the status stays for screen readers. */}
          <p id="capture-status" role="status" className={preview ? "sr-only" : status?.error ? "font-medium text-ink" : "text-ink-2"}>
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
          {preview && (
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
