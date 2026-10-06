"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { captureAction as serverCapture } from "./actions";
import type { ActionResult, CaptureResult } from "./commands";
import { capturedLine } from "./capture-syntax";
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

export function CaptureField({
  captureAction = serverCapture,
  label = "Capture anything",
  placeholder = "Capture anything, then place it later",
}: {
  // Some screens still type their capture as a plain ActionResult; the server sends the full CaptureResult.
  captureAction?: (title: string) => Promise<CaptureResult | ActionResult>;
  label?: string;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const unmark = useRef<() => void>(() => {});

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
    startTransition(async () => {
      const result = await captureAction(title);
      if (!result.ok) {
        setValue((current) => current || title);
        setStatus({ text: result.error, error: true });
        return;
      }
      if ("id" in result) {
        setStatus({ text: capturedLine(result), error: false });
        unmark.current = markWhenShown(result.id);
      }
    });
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="max-w-[440px]">
      <label htmlFor="capture" className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          ref={input}
          id="capture"
          name="title"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          maxLength={TITLE_MAX}
          placeholder={placeholder}
          aria-keyshortcuts="c"
          aria-describedby="capture-status"
          className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-10 pl-3.5 text-ink"
        />
        <kbd
          aria-hidden="true"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-3 pointer-coarse:hidden"
        >
          C
        </kbd>
      </div>
      <p
        id="capture-status"
        role="status"
        className={`mt-1.5 min-h-5 text-[13px] ${status?.error ? "font-medium text-ink" : "text-ink-2"}`}
      >
        {pending ? "Saving" : status?.text}
      </p>
    </form>
  );
}
