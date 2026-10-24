"use client";

import { useState, type CSSProperties } from "react";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import type { BeamState } from "@/features/today/model";
import { formatHour, formatMinutes } from "@/lib/clock";
import styles from "./demos.module.css";

type Row = { id: string; title: string; start: number; end: number; open: Exclude<BeamState, "done"> };

const ROWS: Row[] = [
  { id: "plants", title: "Water the plants", start: 7 * 60 + 30, end: 7 * 60 + 45, open: "planned" },
  { id: "review", title: "Review Ana's draft", start: 9 * 60 + 45, end: 11 * 60 + 15, open: "live" },
  { id: "landlord", title: "Call the landlord", start: 12 * 60 + 30, end: 13 * 60, open: "planned" },
];
const FROM = 7;
const HOURS = 8;
const TICKS = Array.from({ length: HOURS + 1 }, (_, i) => FROM + i);

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/**
 * A staff and the same items as rows. Each row's glyph is its done box, as on the app's lists: ticking it
 * turns the beam above hollow, with the ink sweep the app draws on mark-done; unticking gives back its line.
 */
export function DoneDemo() {
  const clock = useClock();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set(["plants"]));
  const [justDone, setJustDone] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const state = (r: Row): BeamState => (done.has(r.id) ? "done" : r.open);

  function toggle(r: Row) {
    const next = new Set(done);
    const nowDone = !next.has(r.id);
    if (nowDone) next.add(r.id);
    else next.delete(r.id);
    setDone(next);
    setJustDone(nowDone ? r.id : null);
    setSaid(nowDone ? `${r.title} is done.` : `${r.title} is open again.`);
  }

  return (
    <div className={styles.demo}>
      <div className={styles.dragScore} style={vars({ "--span": HOURS })} aria-hidden="true">
        <div className={styles.landAxis}>
          <span className={styles.landName} />
          <div className={styles.landTrack}>
            {TICKS.map((h, i) => (
              <span key={h} className={`${styles.landTick} ${i % 2 ? styles.oddTick : ""} tabular`} style={vars({ "--h": i })}>
                {formatHour(h, clock)}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.landRow}>
          <span className={styles.landName}>Today</span>
          <div className={`${styles.landTrack} ${styles.landStaff}`}>
            {ROWS.map((r) => (
              <div
                key={r.id}
                className={styles.landMover}
                style={vars({ "--at": (r.start / 60 - FROM) / HOURS, "--len": (r.end - r.start) / 60 / HOURS })}
              >
                <span className={`${styles.landBeam} ${styles[state(r)]}`}>
                  <span className={styles.landLabel}>{r.title}</span>
                  <Glyph type="task" state={state(r)} justDone={justDone === r.id} className={styles.landGlyph} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ul className={`${styles.rows} mt-5`}>
        {ROWS.map((r) => (
          <li key={r.id} className={`${styles.row} ${state(r) === "done" ? styles.rowDone : ""}`}>
            <label className={styles.tick}>
              <input type="checkbox" className="sr-only" checked={done.has(r.id)} onChange={() => toggle(r)} aria-label={`Done: ${r.title}`} />
              <Glyph type="task" state={state(r)} justDone={justDone === r.id} />
            </label>
            <span className={`${styles.rowTitle} ${state(r) === "live" ? "font-bold" : ""}`}>{r.title}</span>
            <span className={`${styles.rowTime} tabular`}>
              {state(r) === "live" ? (
                <span className={styles.nowWords}>Now, until {formatMinutes(r.end, clock)}</span>
              ) : (
                formatMinutes(r.start, clock)
              )}
            </span>
          </li>
        ))}
      </ul>
      <p role="status" className={styles.status}>
        {said}
      </p>
    </div>
  );
}
