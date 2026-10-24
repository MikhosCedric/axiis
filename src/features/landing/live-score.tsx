"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import { formatHour, formatMinutes, type Clock } from "@/lib/clock";
import {
  LANDING,
  LIVE_STAVES,
  LIVE_TRAY,
  WIDEST,
  nowParts,
  roomAfter,
  stateAt,
  wallMinutesOf,
  type LiveBeam,
} from "./live-day";
import { useNowMinutes } from "./use-now";
import styles from "./live-score.module.css";

const HOURS = Array.from({ length: WIDEST.to - WIDEST.from + 1 }, (_, i) => WIDEST.from + i);
const STATE_WORD = { live: "happening now", planned: "planned", done: "done" } as const;
const CLOCKS: { clock: Clock; label: string }[] = [
  { clock: "24", label: "24-hour" },
  { clock: "12", label: "12-hour" },
];

/** Each beam's place in the arrival order, counted across the staves. */
const FIRST = LIVE_STAVES.map((_, k) => LIVE_STAVES.slice(0, k).reduce((sum, s) => sum + s.beams.length, 0));

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/**
 * The Score of a made-up day, laid around the visitor's own time now. It draws itself in on arrival
 * (staves, then beams, then the now line sweeping to now), and every so often an Inbox item is lifted
 * onto a line, the way a drag gives it a time. All of it is CSS on transform and opacity; this component
 * only places things and keeps the clock current.
 */
export function LiveScore() {
  const minutes = useNowMinutes();
  const [clock, setClock] = useState<Clock>(useClock());
  const { hour, into } = nowParts(minutes);
  const score = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = score.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute("data-offscreen", !entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const wall = (rel: number) => formatMinutes(wallMinutesOf(rel, hour), clock);

  return (
    <figure className={styles.figure} aria-labelledby="sample-caption">
      <div className={styles.caption}>
        <figcaption id="sample-caption" className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
          <span className="font-serif text-lg font-medium text-ink">A sample day</span>
          <span className="text-ink-3">Made-up items, laid around your time now.</span>
        </figcaption>
        <div role="group" aria-label="Clock" className={styles.clockSwitch}>
          {CLOCKS.map((c) => (
            <button key={c.clock} type="button" aria-pressed={clock === c.clock} onClick={() => setClock(c.clock)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={score} className={styles.score} style={vars({ "--into": into })} aria-hidden="true">
        <div className={styles.sheet}>
          <div className={styles.axisRow}>
            <div className={styles.labelCell} />
            <div className={styles.track}>
              {HOURS.map((h) => (
                <span key={h} className={`${styles.tick} tabular`} style={vars({ "--h": h })}>
                  {formatHour(hour + h, clock)}
                </span>
              ))}
            </div>
          </div>

          {LIVE_STAVES.map((staff, k) => (
            <div key={staff.name} className={styles.staff} style={vars({ "--k": k })}>
              <div className={styles.labelCell}>
                <span className={styles.staffName}>{staff.name}</span>
                <span className="mt-1 block text-xs text-ink-3">
                  {staff.beams.filter((b) => stateAt(b, into) !== "done").length} open
                </span>
              </div>
              <div className={styles.track} style={vars({ "--rows": staff.rows })}>
                {Array.from({ length: staff.rows }, (_, r) => (
                  <div key={r} className={styles.lines} style={vars({ "--row": r })} />
                ))}
                {staff.beams.map((beam, i) => (
                  <Beam
                    key={beam.title}
                    beam={beam}
                    order={FIRST[k] + i}
                    into={into}
                    room={roomAfter(staff, beam, WIDEST.to)}
                    clock={wall(beam.start)}
                  />
                ))}
                {k === LANDING.staff && <Landing clockFrom={wall(LANDING.start)} clockTo={wall(LANDING.end)} />}
              </div>
            </div>
          ))}

          <div className={styles.nowLayer}>
            <div className={styles.nowMover}>
              <span className={`${styles.nowPill} tabular`}>{formatMinutes(minutes, clock)}</span>
              <span className={styles.playhead} />
            </div>
          </div>
        </div>

        <div className={styles.tray}>
          <div className={`${styles.labelCell} ${styles.trayLabel}`}>Inbox</div>
          <ul className={styles.chips}>
            {LIVE_TRAY.map((title) => (
              <li key={title} className={`${styles.chip} ${title === LANDING.title ? styles.lifted : ""}`}>
                <Glyph type="task" state="planned" className={styles.chipGlyph} />
                {title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LineKey />

      <div className="sr-only">
        {LIVE_STAVES.map((staff) => (
          <ul key={staff.name} aria-label={`${staff.name} line`}>
            {staff.beams.map((b) => (
              <li key={b.title}>
                {b.title}, {wall(b.start)} to {wall(b.end)}, {STATE_WORD[stateAt(b, into)]}
                {b.progress && `, ${b.progress.done} of ${b.progress.total} subtasks done`}
              </li>
            ))}
          </ul>
        ))}
        <ul aria-label="Inbox">
          {LIVE_TRAY.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function Beam({ beam, order, into, room, clock }: { beam: LiveBeam; order: number; into: number; room: number; clock: string }) {
  const state = stateAt(beam, into);
  return (
    <div
      className={`${styles.beam} ${styles[state]}`}
      style={vars({ "--s": beam.start, "--e": beam.end, "--room": room, "--row": beam.row, "--n": order })}
    >
      <span className={styles.label}>
        {beam.title}
        {beam.progress && (
          <span className={styles.count}>
            {beam.progress.done}/{beam.progress.total}
          </span>
        )}
        <span className={styles.clock}>{clock}</span>
      </span>
      <Glyph type="task" state={state} className={styles.glyph} />
    </div>
  );
}

/** The loop's drop: a dashed verdigris ghost with its time, which then settles as a planned beam. */
function Landing({ clockFrom, clockTo }: { clockFrom: string; clockTo: string }) {
  const place = vars({ "--s": LANDING.start, "--e": LANDING.end, "--row": 0, "--room": LANDING.end - LANDING.start });
  return (
    <>
      <div className={`${styles.beam} ${styles.ghost}`} style={place}>
        <span className={`${styles.ghostTip} tabular`}>
          {clockFrom} to {clockTo}
        </span>
      </div>
      <div className={`${styles.beam} ${styles.planned} ${styles.landed}`} style={place}>
        <Glyph type="task" state="planned" className={styles.glyph} />
      </div>
    </>
  );
}

export function LineKey() {
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
