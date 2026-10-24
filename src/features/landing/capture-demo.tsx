"use client";

import { useDeferredValue, useId, useState, ViewTransition, type CSSProperties } from "react";
import { useClock } from "@/components/shell/clock-context";
import { CAPTURE_EXAMPLES, parseCapture, previewWords } from "@/features/today/capture-syntax";
import { Glyph } from "@/features/today/glyph";
import { formatHour, formatMinutes } from "@/lib/clock";
import { placeCapture, type Placement } from "./demo-model";
import styles from "./demos.module.css";

const FIRST_LINE = "dentist tomorrow 9am #health";
const EXAMPLES = [FIRST_LINE, ...CAPTURE_EXAMPLES.slice(1)];
const WINDOW_HOURS = 6;

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/**
 * The capture field, read by the app's own parser as you type. The line lands where Axiis would put it:
 * on its day's line at its time, in Any time for a day alone, or in the Inbox. Nothing is saved.
 */
export function CaptureDemo() {
  const clock = useClock();
  const id = useId();
  const [text, setText] = useState(FIRST_LINE);
  // A deferred read lets React run the item's move between rows as a view transition.
  const shown = useDeferredValue(text);
  const place = placeCapture(shown);
  const preview = previewWords(parseCapture(shown), clock);
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
            <button key={line} type="button" className={styles.example} onClick={() => setText(line)} aria-pressed={text === line}>
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
      return `“${place.title}” goes to ${place.day}, any time.`;
    case "timed":
      return `“${place.title}” goes on ${place.day} at ${formatMinutes(place.start, clock)}.`;
  }
}

function Landing({ place, clock }: { place: Placement; clock: "12" | "24" }) {
  const timed = place.kind === "timed" ? place : null;
  const from = timed ? Math.max(0, Math.min(24 - WINDOW_HOURS, Math.floor(timed.start / 60) - 2)) : 7;
  const hours = Array.from({ length: WINDOW_HOURS + 1 }, (_, i) => from + i);
  const day = place.kind === "timed" || place.kind === "anytime" ? place.day : "Today";
  const item = place.kind === "nothing" ? null : <Item place={place} clock={clock} />;

  return (
    <div className={styles.landing} aria-hidden="true" style={vars({ "--from": from, "--span": WINDOW_HOURS })}>
      <div className={styles.landAxis}>
        <span className={styles.landName} />
        <div className={styles.landTrack}>
          {hours.map((h) => (
            <span key={h} className={`${styles.landTick} tabular`} style={vars({ "--h": h - from })}>
              {formatHour(h, clock)}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.landRow}>
        <span className={styles.landName}>{day}</span>
        <div className={`${styles.landTrack} ${styles.landStaff}`}>
          {timed && (
            <div
              className={styles.landMover}
              style={vars({ "--at": (timed.start / 60 - from) / WINDOW_HOURS, "--len": (timed.end - timed.start) / 60 / WINDOW_HOURS })}
            >
              {item}
            </div>
          )}
        </div>
      </div>
      <div className={styles.landRow}>
        <span className={`${styles.landName} ${styles.landSmall}`}>Any time</span>
        <div className={styles.landChips}>{place.kind === "anytime" && item}</div>
      </div>
      <div className={styles.landRow}>
        <span className={`${styles.landName} ${styles.landSmall}`}>Inbox</span>
        <div className={styles.landChips}>{place.kind === "inbox" && item}</div>
      </div>
    </div>
  );
}

function Item({ place, clock }: { place: Exclude<Placement, { kind: "nothing" }>; clock: "12" | "24" }) {
  const tags = place.tags.map((t) => `#${t}`).join(" ");
  return (
    <ViewTransition name="capture-item" share="capture-move" default="none">
      {place.kind === "timed" ? (
        <span className={styles.landBeam}>
          <span className={styles.landLabel}>
            {place.title}
            <span className={styles.landClock}>{formatMinutes(place.start, clock)}</span>
            {tags && <span className={styles.landTags}>{tags}</span>}
          </span>
          <Glyph type="task" state="planned" className={styles.landGlyph} />
        </span>
      ) : (
        <span className={styles.chip}>
          <Glyph type="task" state="planned" className={styles.chipGlyph} />
          <span className="truncate">{place.title}</span>
          {tags && <span className={styles.landTags}>{tags}</span>}
        </span>
      )}
    </ViewTransition>
  );
}
