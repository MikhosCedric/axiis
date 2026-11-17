"use client";

import { startTransition, useId, useState, ViewTransition } from "react";
import { useClock } from "@/components/shell/clock-context";
import { scaleOf } from "@/features/calendar/grid-layout";
import { CAPTURE_EXAMPLES, parseCapture, previewWords } from "@/features/today/capture-syntax";
import { formatMinutes } from "@/lib/clock";
import { placeCapture, type Placement } from "./demo-model";
import { packSample } from "./grid-pack";
import { MiniBlock, MiniChip, TimeGrid } from "./mini-grid";
import styles from "./demos.module.css";

const FIRST_LINE = "dentist tomorrow 9am #health";
const EXAMPLES = [FIRST_LINE, ...CAPTURE_EXAMPLES.slice(1)];
const WINDOW_HOURS = 6;
const HOUR_PX = 44;

/**
 * The capture field, read by the app's own parser as you type. The line lands where Axiis would put it:
 * as a block on its day at its time, in Any time for a day alone, or in the Inbox. Nothing is saved.
 */
export function CaptureDemo() {
  const clock = useClock();
  const id = useId();
  const [text, setText] = useState(FIRST_LINE);
  const place = placeCapture(text);
  const preview = previewWords(parseCapture(text), clock);
  const [said, setSaid] = useState("");

  const where = describe(place, clock);

  return (
    <div className={styles.demo}>
      <form
        className={styles.captureForm}
        onSubmit={(e) => {
          e.preventDefault();
          setSaid(where ? `${where} Nothing was saved; this is a sample.` : "");
        }}
      >
        <label htmlFor={`${id}-line`} className={styles.fieldLabel}>
          Type a line
        </label>
        <input
          id={`${id}-line`}
          className={styles.captureInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-reads`}
        />
        <p id={`${id}-reads`} className={styles.reads}>
          {preview ? (
            <>
              <span className="text-ink-3">Reads</span> <span className="font-medium text-ink tabular">{preview}</span>
            </>
          ) : (
            <span className="text-ink-3">{place.kind === "nothing" ? "Type one thing you have to do." : "No day or time: it waits in the Inbox."}</span>
          )}
        </p>
        <div className={styles.examples}>
          <span className="text-ink-3">Try</span>
          {EXAMPLES.map((line) => (
            <button
              key={line}
              type="button"
              className={styles.example}
              // Only a chosen example moves the item as a view transition. Typing stays a plain update: a
              // transition holds the page while it snapshots, and keys pressed then would be lost.
              onClick={() => startTransition(() => setText(line))}
              aria-pressed={text === line}
            >
              {line}
            </button>
          ))}
        </div>
        <p role="status" className={styles.status}>
          {said}
        </p>
      </form>

      <Landing place={place} clock={clock} />
    </div>
  );
}

function describe(place: Placement, clock: "12" | "24"): string {
  switch (place.kind) {
    case "nothing":
      return "";
    case "inbox":
      return `“${place.title}” goes to the Inbox.`;
    case "anytime":
      return place.repeats ? `“${place.title}” repeats ${place.repeats.words}, any time.` : `“${place.title}” lands ${place.day}, any time.`;
    case "timed":
      return place.repeats
        ? `“${place.title}” repeats ${place.repeats.words} at ${formatMinutes(place.start, clock)}.`
        : `“${place.title}” lands ${place.day} at ${formatMinutes(place.start, clock)}.`;
  }
}

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** A sample week under the day: the days a repeat falls on carry a planned (dashed) mark, the others a quiet tick. */
function RepeatRow({ place }: { place: Placement }) {
  const repeats = place.kind === "timed" || place.kind === "anytime" ? place.repeats : null;
  return (
    <div className={styles.landRow}>
      <span className={`${styles.landName} ${styles.landSmall}`}>Repeats</span>
      <div className={styles.landChips}>
        <span className={styles.weekStrip}>
          {WEEK_LETTERS.map((letter, i) => (
            <span key={i} className={styles.weekDay} data-on={repeats?.week.includes(i) ? "" : undefined}>
              {letter}
            </span>
          ))}
        </span>
        <span className={`${styles.weekWords} ${repeats ? "text-ink-2" : "text-ink-3"}`}>
          {repeats ? capitalise(repeats.words) : "Once"}
        </span>
      </div>
    </div>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Landing({ place, clock }: { place: Placement; clock: "12" | "24" }) {
  const timed = place.kind === "timed" ? place : null;
  const from = timed ? Math.max(0, Math.min(24 - WINDOW_HOURS, Math.floor(timed.start / 60) - 2)) : 7;
  const scale = scaleOf(from * 60, (from + WINDOW_HOURS) * 60, HOUR_PX);
  const day = place.kind === "timed" || place.kind === "anytime" ? place.day : "today";
  const tags = place.kind === "nothing" ? "" : place.tags.map((t) => `#${t}`).join(" ");
  const title = place.kind === "nothing" ? "" : place.title;
  const [block] = timed ? packSample([{ id: "new", title, start: timed.start, end: timed.end }], scale) : [];

  return (
    <div className={styles.landing} aria-hidden="true">
      <TimeGrid
        scale={scale}
        clock={clock}
        anyLabel="Any time"
        columns={[
          {
            key: "day",
            head: capitalise(day),
            anyTime: place.kind === "anytime" && (
              <ViewTransition name="capture-item" share="capture-move" default="none">
                <MiniChip title={title} area={null} />
              </ViewTransition>
            ),
            children: block && (
              <ViewTransition name="capture-item" share="capture-move" default="none">
                <MiniBlock block={block} clock={clock} area={null} state="planned" hint={tags} />
              </ViewTransition>
            ),
          },
        ]}
      />
      <RepeatRow place={place} />
      <div className={styles.landRow}>
        <span className={`${styles.landName} ${styles.landSmall}`}>Inbox</span>
        <div className={styles.landChips}>
          {place.kind === "inbox" && (
            <ViewTransition name="capture-item" share="capture-move" default="none">
              <MiniChip title={title} area={null} />
            </ViewTransition>
          )}
        </div>
      </div>
    </div>
  );
}
