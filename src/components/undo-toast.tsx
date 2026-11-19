"use client";

import { useEffect, useRef, useState } from "react";
import { isTypingTarget } from "@/features/day/nav";

/** How long a note with an Undo stays, unless a pointer or focus is on it. */
const UNDO_MS = 6000;

/** One piece of news about a change just made, and how to take it back. `id` tells two notes with the same words apart. */
export type UndoNote = { id: number; text: string; undo?: () => void };

/**
 * A note that floats above the page's foot (above the bar on a phone) saying
 * what just changed, with Undo for six seconds. Ctrl or Cmd Z does the same
 * while focus is not in a text field. It waits while a pointer rests on it or
 * focus is inside it, so it never leaves under the hand reaching for Undo.
 */
export function UndoToast({ note, onDone }: { note: UndoNote | null; onDone: () => void }) {
  const [held, setHeld] = useState(false);
  const done = useRef(onDone);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!note || held) return;
    const timer = window.setTimeout(() => done.current(), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [note, held]);

  useEffect(() => {
    const undo = note?.undo;
    if (!undo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "z" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target as HTMLElement | null)) return;
      e.preventDefault();
      run(undo!);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [note]);

  function run(undo: () => void) {
    // Undo is about to go, so let focus fall back to the page; the screen puts it on the item it brings back.
    if (box.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    setHeld(false);
    done.current();
    undo();
  }

  // The note stays drawn for the moment it takes to fade out, so it leaves rather than vanishes.
  const [last, setLast] = useState<UndoNote | null>(note);
  if (note && note !== last) setLast(note);
  useEffect(() => {
    if (note) return;
    // Under reduced motion it does not fade, so it is gone at once rather than lingering as a picture of itself.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gone = window.setTimeout(() => setLast(null), still ? 0 : 140);
    return () => window.clearTimeout(gone);
  }, [note]);
  const shown = note ?? last;
  const out = !note && !!shown;

  // The status stays mounted with nothing in it, so a screen reader hears each new note; Undo sits beside it, not in it.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 rail:bottom-6 rail:left-[216px]">
      <div
        ref={box}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
        }}
        // Leaving, the note is a picture of itself: it takes no pointer, no focus and is not read again.
        inert={out}
        aria-hidden={out || undefined}
        className={
          shown
            ? `${out ? "pointer-events-none motion-safe:animate-toast-out" : "pointer-events-auto motion-safe:animate-toast-in"} flex max-w-[min(34rem,calc(100vw-2rem))] items-center gap-3 rounded-lg border border-rule bg-sheet py-1.5 pr-1.5 pl-4 text-ink shadow-float`
            : "sr-only"
        }
      >
        <p role="status" className="min-w-0 py-1.5">
          {shown?.text}
        </p>
        {shown?.undo && (
          <button
            type="button"
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={() => shown.undo && run(shown.undo)}
            className="ml-auto h-9 flex-none rounded-md px-3 font-medium text-ink underline decoration-rule underline-offset-3 hover:bg-hover active:bg-press pointer-coarse:h-11"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
