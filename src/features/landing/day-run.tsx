import type { CSSProperties } from "react";
import { Glyph } from "@/features/today/glyph";
import { formatHour, formatMinutes, type Clock } from "@/lib/clock";
import { FLAG_STEP, PHASES, RUN_AXIS, RUN_STAVES, STILL_HOUR, rangeAt, shareOf, type RunBeam } from "./day-run-model";
import { stateAt } from "./live-day";
import styles from "./day-run.module.css";

const SPAN = RUN_AXIS.to - RUN_AXIS.from;
const HOURS = Array.from({ length: SPAN + 1 }, (_, i) => RUN_AXIS.from + i);
const FLAGS = Array.from({ length: SPAN / FLAG_STEP + 1 }, (_, i) => RUN_AXIS.from + i * FLAG_STEP);

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/** Two ranges on the run's scroll: where a change starts (`--a`, `--a2`) and where the next one does (`--b`, `--b2`). */
function ranges(from: number, to: number) {
  const a = rangeAt(from);
  const b = rangeAt(to);
  return { "--a": a.from, "--a2": a.to, "--b": b.from, "--b2": b.to };
}

/**
 * A sample day that runs as the reader scrolls: the stage holds still while now crosses it from morning
 * to evening, and each beam turns solid, then hollow, as now passes. It is all CSS scroll-driven animation
 * on opacity and transform; with reduced motion, or in a browser without it, the stage is one still moment.
 */
export function DayRun({ clock, titleClassName }: { clock: Clock; titleClassName: string }) {
  const stillPhase = PHASES.findIndex((p) => STILL_HOUR >= p.from && STILL_HOUR < p.to);
  return (
    <div className={styles.run} aria-labelledby="run-title" role="group">
      <div className={styles.stage}>
        <div className={styles.head}>
          <h3 id="run-title" className={titleClassName}>
            A day, as it goes.
          </h3>
          <p className={styles.lead}>
            Scroll, and a sample day runs from {formatMinutes(RUN_AXIS.from * 60, clock)} to{" "}
            {formatMinutes(RUN_AXIS.to * 60, clock)}. A line is dashed until its time comes, solid while it is on, and
            hollow once it is over.
          </p>
          <p className={styles.phases} aria-hidden="true">
            {PHASES.map((p, i) => (
              <span
                key={p.name}
                className={styles.phase}
                data-still={i === stillPhase ? "" : undefined}
                data-first={i === 0 ? "" : undefined}
                data-last={i === PHASES.length - 1 ? "" : undefined}
                style={vars(ranges(p.from, p.to))}
              >
                <span>{p.name}</span>
              </span>
            ))}
          </p>
        </div>

        <div className={styles.score} aria-hidden="true">
          <div className={styles.names}>
            <span className={styles.axisGap} />
            {RUN_STAVES.map((s) => (
              <span key={s.name} className={styles.name}>
                {s.name}
              </span>
            ))}
          </div>
          <div className={styles.window}>
            <div className={styles.track} style={vars({ "--span": SPAN, "--p": shareOf(STILL_HOUR) })}>
              <div className={styles.axis}>
                {HOURS.map((h) => (
                  <span key={h} className={`${styles.tick} tabular`} style={vars({ "--h": h - RUN_AXIS.from })}>
                    {formatHour(h, clock)}
                  </span>
                ))}
              </div>
              {RUN_STAVES.map((s) => (
                <div key={s.name} className={styles.staff}>
                  {s.beams.map((b) => (
                    <Beam key={b.title} beam={b} clock={clock} />
                  ))}
                </div>
              ))}
              <div className={styles.now}>
                <span className={`${styles.flag} tabular`}>
                  <span className={styles.reel} style={vars({ "--steps": FLAGS.length - 1, "--still": (STILL_HOUR - RUN_AXIS.from) / FLAG_STEP })}>
                    {FLAGS.map((h) => (
                      <span key={h}>{formatMinutes(Math.round(h * 60), clock)}</span>
                    ))}
                  </span>
                </span>
                <span className={styles.line} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Beam({ beam, clock }: { beam: RunBeam; clock: Clock }) {
  return (
    <div
      className={styles.beam}
      data-still={stateAt(beam, STILL_HOUR)}
      style={vars({ "--s": beam.start - RUN_AXIS.from, "--e": beam.end - RUN_AXIS.from, ...ranges(beam.start, beam.end) })}
    >
      <span className={styles.label}>
        {beam.title} <span className={styles.clock}>{formatMinutes(beam.start * 60, clock)}</span>
      </span>
      <Glyph type="task" state="planned" className={`${styles.glyph} ${styles.planned}`} />
      <span className={styles.liveOut}>
        <Glyph type="task" state="live" className={`${styles.glyph} ${styles.liveIn}`} />
      </span>
      <Glyph type="task" state="done" className={`${styles.glyph} ${styles.done}`} />
    </div>
  );
}
