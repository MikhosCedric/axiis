import type { CSSProperties } from "react";
import { scaleOf } from "@/features/calendar/grid-layout";
import { formatHour, formatMinutes, type Clock } from "@/lib/clock";
import { FLAG_STEP, PHASES, RUN_AREAS, RUN_AXIS, RUN_BLOCKS, STILL_HOUR, rangeAt, shareOf, type RunBlock } from "./day-run-model";
import { stateAt } from "./live-day";
import { packSample, type Packed } from "./grid-pack";
import styles from "./day-run.module.css";

const SPAN = RUN_AXIS.to - RUN_AXIS.from;
const HOURS = Array.from({ length: SPAN }, (_, i) => RUN_AXIS.from + i + 1).filter((h) => h < RUN_AXIS.to);
const FLAGS = Array.from({ length: SPAN / FLAG_STEP + 1 }, (_, i) => RUN_AXIS.from + i * FLAG_STEP);
/** The packer only needs a scale to place side by side; the hour's height is the stylesheet's own. */
const SCALE = scaleOf(RUN_AXIS.from * 60, RUN_AXIS.to * 60, 56);
const PACKED = packSample(
  RUN_BLOCKS.map((b) => ({ ...b, id: b.title, start: b.start * 60, end: b.end * 60 })),
  SCALE,
);

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/** The three line forms the run passes each block through, in the order now gives them. */
const KEY = [
  { form: "planned", term: "Dashed", words: "its time has not come" },
  { form: "live", term: "Solid", words: "it is on now" },
  { form: "done", term: "Hollow", words: "it is over" },
] as const;

/** Two ranges on the run's scroll: where a change starts (`--a`, `--a2`) and where the next one does (`--b`, `--b2`). */
function ranges(from: number, to: number) {
  const a = rangeAt(from);
  const b = rangeAt(to);
  return { "--a": a.from, "--a2": a.to, "--b": b.from, "--b2": b.to };
}

/**
 * A sample day on the time grid that runs as the reader scrolls: the stage holds still while now crosses it
 * from morning to evening, and each block turns solid, then hollow, as now passes. It is all CSS scroll-driven
 * animation on opacity and transform; with reduced motion, or in a browser without it, the stage is one still moment.
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
            {formatMinutes(RUN_AXIS.to * 60, clock)}. Dashed until its time comes, solid while it is on, hollow once it
            is over.
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
          <div className={styles.window}>
            <div className={styles.track} style={vars({ "--span": SPAN, "--p": shareOf(STILL_HOUR) })}>
              {HOURS.map((h) => (
                <span key={h} className={`${styles.tick} tabular`} style={vars({ "--h": h - RUN_AXIS.from })}>
                  {formatHour(h, clock)}
                </span>
              ))}
              <div className={styles.day}>
                {PACKED.map((b) => (
                  <Block key={b.id} block={b} clock={clock} />
                ))}
              </div>
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

        <dl className={styles.key}>
          {KEY.map((k) => (
            <div key={k.form}>
              <dt>
                <span className={`${styles.keyMark} ${styles[`key_${k.form}`]}`} aria-hidden="true" />
                {k.term}
              </dt>
              <dd>{k.words}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Block({ block, clock }: { block: Packed<RunBlock & { id: string }>; clock: Clock }) {
  const start = block.start / 60;
  const end = block.end / 60;
  const left = block.column / block.columns;
  const width = block.span / block.columns;
  return (
    <div
      className={styles.block}
      data-still={stateAt({ start, end }, STILL_HOUR)}
      data-short={end - start < 0.75 ? "" : undefined}
      style={vars({
        "--s": start - RUN_AXIS.from,
        "--e": end - RUN_AXIS.from,
        "--tint": `var(--area-${RUN_AREAS[block.area]})`,
        left: `calc(${left * 100}% + 1px)`,
        width: `calc(${width * 100}% - 3px)`,
        ...ranges(start, end),
      })}
    >
      <span className={styles.words}>
        <span className={styles.title}>{block.title}</span> <span className={styles.clock}>{formatMinutes(Math.round(start * 60), clock)}</span>
      </span>
      <span className={`${styles.mark} ${styles.planned}`}>
        <i />
      </span>
      <span className={`${styles.mark} ${styles.liveOut}`}>
        <i className={styles.liveIn} />
      </span>
      <span className={`${styles.mark} ${styles.done}`}>
        <i />
      </span>
      <span className={styles.veil} />
    </div>
  );
}
