"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Floating } from "@/components/floating";
import { useWeekStart } from "@/components/shell/week-start-context";
import type { LocalDate } from "@/domain/item";
import { useAreas } from "@/components/shell/areas-context";
import { momentHere, parseCapture, previewWords, type CaptureArea, type Moment } from "@/features/today/capture-syntax";
import type { ActionResult, CaptureResult } from "@/features/today/commands";
import { formatDayHeading } from "@/features/today/format";
import { TITLE_MAX } from "@/features/today/model";
import { formatMinutes, type Clock } from "@/lib/clock";
import type { Box } from "@/lib/placement";
import { reach } from "@/lib/reach";
import { slotCapture, type Slot } from "./grid-drop";

/**
 * Capture, opened on a slot of the grid: the same plain-English line the capture field takes, empty, with the
 * same preview of what it understood underneath. The slot's day, time and length are held apart and applied
 * when saving as the default schedule; a day, time or length typed in the line wins over them. What is saved
 * goes to the same capture command, so anything capture reads (a tag, a repeat) works here too.
 */
export function QuickCreate({
  slot,
  at,
  today,
  clock,
  onCapture,
  onCaptured,
  onClosed,
}: {
  slot: Slot;
  at: Box;
  today: LocalDate;
  clock: Clock;
  onCapture: (text: string) => Promise<CaptureResult | ActionResult>;
  /** The capture saved; the layer closes itself after this. */
  onCaptured: (result: CaptureResult | ActionResult, text: string) => void;
  onClosed: (refocus: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moment, setMoment] = useState<Moment | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const weekStart = useWeekStart();
  const areas = useAreas() as readonly CaptureArea[] | undefined;
  const options = { weekStart, areas };
  const full = slotCapture(value, slot, today, clock, options);
  const said = parseCapture(full.text, options);
  const typed = parseCapture(value, options);
  const range = `${formatMinutes(slot.start, clock)} to ${formatMinutes(slot.start + slot.length, clock)}`;
  // What will be saved: the slot as written when nothing typed overrides it, else what capture read.
  const preview = (() => {
    if (full.day || full.time) return previewWords(said, clock, moment ?? { today });
    const rest = previewWords({ ...typed, day: null, time: null }, clock, moment ?? { today });
    return [`${formatDayHeading(slot.day)}, ${range}`, rest].filter(Boolean).join(", ");
  })();
  const untitled = said.untitled || !full.title;

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = full.text.trim();
    if (!text || untitled || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await reach(onCapture(text));
      if (result.ok) onCaptured(result, text);
      else setError(result.error);
    });
  }

  return (
    <Floating at={at} label="New item" onClosed={onClosed} className="w-[min(22rem,calc(100vw-2rem))] p-3.5">
      <form onSubmit={submit} autoComplete="off">
        <p className="font-display text-[17px] leading-tight font-medium">
          {formatDayHeading(slot.day)} <span className="text-ink-2 tabular">{range}</span>
        </p>
        <label htmlFor="slot-capture" className="sr-only">
          What is it
        </label>
        <input
          id="slot-capture"
          data-autofocus
          name="title"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMoment(momentHere());
          }}
          maxLength={TITLE_MAX}
          placeholder="Add a title, e.g. Dentist"
          aria-describedby="slot-capture-preview slot-capture-status"
          className="mt-2.5 w-full rounded-lg border border-field bg-sheet px-3 py-2 text-ink"
        />
        <div className="mt-2 flex min-h-8 items-start justify-between gap-3">
          <div className="min-w-0 pt-1 text-[13px]">
            <p id="slot-capture-preview" className="text-ink-2">
              {untitled ? (
                "Type what it is. The day and time are already in."
              ) : (
                preview && (
                  <>
                    <span className="sr-only">Understood: </span>
                    <span className="rounded border border-rule px-1.5 py-px">{preview}</span>
                  </>
                )
              )}
            </p>
            <p id="slot-capture-status" role="status" className="font-medium text-ink">
              {pending ? "Saving" : error}
            </p>
          </div>
          <button
            type="submit"
            aria-disabled={untitled || pending}
            className="press flex-none rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-paper aria-disabled:opacity-55 pointer-coarse:min-h-11"
          >
            Add
          </button>
        </div>
      </form>
    </Floating>
  );
}
