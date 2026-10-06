import type { CSSProperties } from "react";
import { Glyph } from "@/features/today/glyph";
import { SAMPLE_NOW, SAMPLE_STAVES, SAMPLE_TRAY, clock, roomAfter, type SampleBeam } from "./sample-day";
import styles from "./sample-score.module.css";

const DAY_END = 19;
const HOURS = Array.from({ length: 13 }, (_, i) => 7 + i);
const STATE_WORD = { live: "happening now", planned: "planned", done: "done" } as const;

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/** The Score drawn from a fixed sample day. Static: nothing here can be dragged or opened. */
export function SampleScore() {
  return (
    <figure className={styles.figure} aria-labelledby="sample-caption">
      <figcaption id="sample-caption" className={styles.caption}>
        <span className="font-serif text-lg font-medium text-ink">A sample day</span>
        <span className="text-ink-3">Made-up items, drawn the way Axiis draws yours.</span>
      </figcaption>

      <div className={styles.score} style={vars({ "--now": SAMPLE_NOW })} aria-hidden="true">
        <div className={styles.axisRow}>
          <div className={styles.labelCell} />
          <div className={styles.track}>
            {HOURS.map((h) => (
              <span key={h} className={`${styles.tick} tabular`} style={vars({ "--h": h })}>
                {String(h).padStart(2, "0")}
              </span>
            ))}
            <span className={`${styles.nowPill} tabular`}>{clock(SAMPLE_NOW)}</span>
          </div>
        </div>

        <div className={styles.staves}>
          <div className={styles.playhead} />
          {SAMPLE_STAVES.map((staff) => (
            <div key={staff.name} className={styles.staff}>
              <div className={styles.labelCell}>
                <span className={styles.staffName}>{staff.name}</span>
                <span className="mt-1 block text-xs text-ink-3">
                  {staff.beams.filter((b) => b.state !== "done").length} open
                </span>
              </div>
              <div className={styles.track} style={vars({ "--rows": staff.rows })}>
                {Array.from({ length: staff.rows }, (_, r) => (
                  <div key={r} className={styles.lines} style={vars({ "--row": r })} />
                ))}
                {staff.beams.map((beam) => (
                  <Beam key={beam.title} beam={beam} room={roomAfter(staff, beam, DAY_END)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.tray}>
          <div className={`${styles.labelCell} ${styles.trayLabel}`}>Waiting</div>
          <ul className={styles.chips}>
            {SAMPLE_TRAY.map((title) => (
              <li key={title} className={styles.chip}>
                <Glyph type="task" state="planned" className={styles.chipGlyph} />
                {title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SampleKey />

      <div className="sr-only">
        {SAMPLE_STAVES.map((staff) => (
          <ul key={staff.name} aria-label={`${staff.name} line`}>
            {staff.beams.map((b) => (
              <li key={b.title}>
                {b.title}, {clock(b.start)} to {clock(b.end)}, {STATE_WORD[b.state]}
                {b.progress && `, ${b.progress.done} of ${b.progress.total} subtasks done`}
              </li>
            ))}
          </ul>
        ))}
        <ul aria-label="Waiting">
          {SAMPLE_TRAY.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function Beam({ beam, room }: { beam: SampleBeam; room: number }) {
  return (
    <div
      className={`${styles.beam} ${styles[beam.state]}`}
      style={vars({ "--s": beam.start, "--e": beam.end, "--room": room, "--row": beam.row })}
    >
      <span className={styles.label}>
        {beam.title}
        {beam.progress && (
          <span className={styles.count}>
            {beam.progress.done}/{beam.progress.total}
          </span>
        )}
        <span className={styles.clock}>{clock(beam.start)}</span>
      </span>
      <Glyph type="task" state={beam.state} className={styles.glyph} />
    </div>
  );
}

export function SampleKey() {
  const entries = [
    { state: "live", word: "Solid", meaning: "happening now" },
    { state: "planned", word: "Dashed", meaning: "planned" },
    { state: "done", word: "Hollow", meaning: "done" },
  ] as const;
  return (
    <dl className={styles.key}>
      {entries.map((e) => (
        <div key={e.state} className="flex items-center gap-2.5">
          <dt className="flex items-center gap-2.5">
            <Glyph type="task" state={e.state} />
            <span className="font-medium text-ink">{e.word}</span>
          </dt>
          <dd className="text-ink-2">{e.meaning}</dd>
        </div>
      ))}
      <div className="flex items-center gap-2.5">
        <dt className="flex items-center gap-2.5">
          <span className={styles.keyPlayhead} />
          <span className="font-medium text-ink">Line</span>
        </dt>
        <dd className="text-ink-2">now</dd>
      </div>
    </dl>
  );
}
