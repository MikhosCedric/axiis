"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { captureAction as serverCapture } from "./actions";
import type { ActionResult } from "./commands";
import { TITLE_MAX } from "./model";

export function CaptureField({
  captureAction = serverCapture,
}: {
  captureAction?: (title: string) => Promise<ActionResult>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    setError(null);
    startTransition(async () => {
      const result = await captureAction(title);
      if (!result.ok) {
        setValue((current) => current || title);
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="max-w-[440px]">
      <label htmlFor="capture" className="sr-only">
        Capture anything
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
          placeholder="Capture anything, then place it later"
          aria-keyshortcuts="c"
          aria-describedby="capture-status"
          className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-10 pl-3.5 text-ink"
        />
        <kbd
          aria-hidden="true"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-3"
        >
          C
        </kbd>
      </div>
      <p id="capture-status" role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {error ?? (pending ? "Saving" : "")}
      </p>
    </form>
  );
}
