"use client";

import { startTransition, useState, ViewTransition } from "react";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import type { BeamState } from "@/features/today/model";
import { formatMinutes } from "@/lib/clock";
import { focusSplit, foldedLine, type DayRow } from "./demo-model";
import styles from "./demos.module.css";

const at = (h: number, m = 0) => h * 60 + m;
const NOW = at(11, 20);
const DAY: DayRow[] = [
  { id: "run", title: "Easy run", start: at(7), end: at(7, 45), done: true },
  { id: "summary", title: "Write the quarterly summary", start: at(8, 30), end: at(10), done: true },
  { id: "review", title: "Review Ana's draft", start: at(10, 45), end: at(12, 15), done: false },
  { id: "landlord", title: "Call the landlord", start: at(12, 30), end: at(12, 45), done: false },
  { id: "physio", title: "Physio exercises", start: at(13), end: at(13, 30), done: false },
  { id: "plan", title: "Plan next week", start: at(14), end: at(15, 30), done: false },
  { id: "venue", title: "Reply to the venue", start: at(16), end: at(16, 30), done: false },
  { id: "groceries", title: "Groceries", start: at(17, 30), end: at(18, 15), done: false },
];
const SPLIT = focusSplit(DAY, NOW);

const stateOf = (r: DayRow): BeamState => (r.done ? "done" : r.start <= NOW && NOW < r.end ? "live" : "planned");

/** Today with Focus: on, the day folds to what is happening and the next three, and the rest waits behind one line. */
export function FocusDemo() {
  const clock = useClock();
  const [focus, setFocus] = useState(false);
  const [whole, setWhole] = useState(false);
  const rows = focus ? (whole ? [...SPLIT.kept, ...DAY.filter((r) => !SPLIT.kept.includes(r))] : SPLIT.kept) : DAY;

  return (
    <div className={styles.demo}>
      <div className={styles.focusHead}>
        <span className="font-serif text-[18px] font-medium text-ink">{focus ? "Next up" : "Today"}</span>
        <span className="text-ink-3 tabular">at {formatMinutes(NOW, clock)}</span>
        <button
          type="button"
          className={styles.focusToggle}
          aria-pressed={focus}
          onClick={() =>
            startTransition(() => {
              setFocus(!focus);
              setWhole(false);
            })
          }
        >
          Focus
        </button>
      </div>
      <ol className={styles.rows}>
        {rows.map((r) => (
          <ViewTransition key={r.id} name={`focus-${r.id}`} update="focus-move" enter="focus-in" exit="focus-out" default="none">
            <li className={`${styles.row} ${r.done ? styles.rowDone : ""}`}>
              <span className={styles.rowGlyph}>
                <Glyph type="task" state={stateOf(r)} />
              </span>
              <span className={`${styles.rowTitle} ${stateOf(r) === "live" ? "font-bold" : ""}`}>{r.title}</span>
              <span className={`${styles.rowTime} tabular`}>
                {stateOf(r) === "live" ? (
                  <span className={styles.nowWords}>Now, until {formatMinutes(r.end, clock)}</span>
                ) : (
                  formatMinutes(r.start, clock)
                )}
              </span>
            </li>
          </ViewTransition>
        ))}
      </ol>
      {focus && (
        <ViewTransition enter="focus-in" exit="focus-out" default="none">
          <button
            type="button"
            className={styles.fold}
            aria-expanded={whole}
            onClick={() => startTransition(() => setWhole(!whole))}
          >
            <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className={styles.foldChevron}>
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            The whole day{" "}
            <span className="font-normal text-ink-3">{foldedLine(SPLIT)}</span>
          </button>
        </ViewTransition>
      )}
    </div>
  );
}
