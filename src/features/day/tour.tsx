"use client";

import { useRef, useState } from "react";
import { TOUR_COOKIE } from "@/components/shell/cookies";

/** Four steps, each one thing a newcomer needs before the rest makes sense. */
export const TOUR_STEPS: { title: string; body: string }[] = [
  {
    title: "Capture first, sort later",
    body: "Type anything into the field above and press Enter. Add a day or a time, as in “dentist tomorrow 9:00”, and it is planned; without one it goes to the Inbox.",
  },
  {
    title: "The Score is your day",
    body: "Each area of your life is a staff, and time runs left to right. A beam is something with a time: dashed while planned, solid while it happens, hollow once done. The green line is now.",
  },
  {
    title: "Inbox or Today",
    body: "The Inbox holds what has no day yet. Today holds what is planned for today, at a time or at any time. Plan from the Inbox when you are ready; nothing there is late.",
  },
  {
    title: "The Guide explains the rest",
    body: "The Guide button, or ? anywhere, explains the words and keys of the screen you are on. You can take this tour again from there.",
  },
];

/** Remembers on this device that the tour is finished or skipped, so it never shows again unless asked for. */
function finish() {
  document.cookie = `${TOUR_COOKIE}=done; path=/; max-age=31536000; samesite=lax`;
}

/** A short, skippable tour on Today: one step at a time, in a ruled section under the head, never over the page. */
export function Tour() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const next = useRef<HTMLButtonElement>(null);
  if (!open) return null;
  const { title, body } = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  function close() {
    finish();
    setOpen(false);
  }

  function go(to: number) {
    setStep(to);
    next.current?.focus();
  }

  return (
    <section aria-labelledby="tour-h" aria-describedby="tour-body" className="mb-6 max-w-[760px] border-y border-rule py-4">
      <h2 id="tour-h" className="font-serif text-[17px] leading-tight font-medium">
        {title}
      </h2>
      <p id="tour-body" className="mt-1.5 max-w-[62ch] leading-relaxed text-ink-2">
        {body}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="rounded-lg border border-rule px-3 py-1.5 font-medium text-ink-2 hover:bg-hover active:bg-press pointer-coarse:min-h-11"
          >
            Back
          </button>
        )}
        <button
          ref={next}
          type="button"
          onClick={() => (last ? close() : go(step + 1))}
          className="rounded-lg bg-ink px-3 py-1.5 font-medium text-paper hover:opacity-90 pointer-coarse:min-h-11"
        >
          {last ? "Done" : "Next"}
        </button>
        <span className="px-1 text-xs font-medium text-ink-3 tabular" aria-live="polite">
          Tour, {step + 1} of {TOUR_STEPS.length}
        </span>
        {!last && (
          <button
            type="button"
            onClick={close}
            className="ml-auto rounded-md px-2 py-1.5 font-medium text-ink-3 hover:bg-hover hover:text-ink-2 active:bg-press pointer-coarse:min-h-11"
          >
            Skip the tour
          </button>
        )}
      </div>
    </section>
  );
}
