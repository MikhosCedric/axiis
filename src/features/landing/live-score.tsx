"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { useClock } from "@/components/shell/clock-context";
import { scaleOf } from "@/features/calendar/grid-layout";
import { formatMinutes, type Clock } from "@/lib/clock";
import {
  LANDING,
  LIVE_ANYTIME,
  LIVE_AREAS,
  LIVE_BLOCKS,
  LIVE_TRAY,
  LIVE_WINDOW,
  axisMinutes,
  nowParts,
  stateOn,
  wallMinutesOf,
  type LiveBlock,
} from "./live-day";
import { packSample } from "./grid-pack";
import { MiniBlock, MiniChip, TimeGrid, type GridColumn } from "./mini-grid";
import { useNowMinutes } from "./use-now";
import styles from "./live-score.module.css";

const HOUR_PX = 48;
const STATE_WORD = { live: "happening now", planned: "planned", done: "done" } as const;
const CLOCKS: { clock: Clock; label: string }[] = [
  { clock: "24", label: "24-hour" },
  { clock: "12", label: "12-hour" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** What the server draws for the three day heads, before the browser knows today. */
const SERVER_HEADS = "Tue 17|Wed 18|Thu 19";

const noop = () => () => {};
function headsNow(): string {
  const d = new Date();
  return [0, 1, 2]
    .map((k) => {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
      return `${DAYS[day.getDay()]} ${day.getDate()}`;
    })
    .join("|");
}

const vars = (v: Record<string, number | string>) => v as CSSProperties;
const DAY_NAMES = ["Today", "Tomorrow", "The day after"];

/**
 * A sample of the app's Week, laid around the visitor's own time now: three days as columns, hours down the
 * side, an Any time row, the Inbox as a tray under the grid and the line for now. On arrival the blocks slide
 * onto the grid in order and the now line sweeps down to now; every so often an Inbox item is lifted onto the
 * day, the way a drag gives it a time. All of it is CSS on transform and opacity; this component only places
 * things and keeps the clock current. Nothing under the pointer moves.
 */
export function LiveScore() {
  const minutes = useNowMinutes();
  const [clock, setClock] = useState<Clock>(useClock());
  const heads = useSyncExternalStore(noop, headsNow, () => SERVER_HEADS).split("|");
  const { hour, into } = nowParts(minutes);
  const scale = scaleOf(axisMinutes(LIVE_WINDOW.from, hour), axisMinutes(LIVE_WINDOW.to, hour), HOUR_PX);
  const wall = (rel: number) => formatMinutes(wallMinutesOf(rel, hour), clock);
  const area = (b: Pick<LiveBlock, "area">) => LIVE_AREAS[b.area];

  const columns: GridColumn[] = [0, 1, 2].map((day) => {
    const blocks = LIVE_BLOCKS.filter((b) => b.day === day);
    const packed = packSample(
      blocks.map((b) => ({ ...b, id: b.title, start: axisMinutes(b.start, hour), end: axisMinutes(b.end, hour) })),
      scale,
    );
    return {
      key: `d${day}`,
      head: heads[day],
      today: day === 0,
      extra: day > 0,
      anyTime: LIVE_ANYTIME.filter((a) => a.day === day).map((a) => <MiniChip key={a.title} title={a.title} area={LIVE_AREAS[a.area]} />),
      children: (
        <>
          {packed.map((p) => (
            <MiniBlock
              key={p.id}
              block={p}
              clock={clock}
              area={area(p)}
              state={stateOn(blocks.find((b) => b.title === p.id)!, into)}
              hint={p.progress ? `${p.progress.done}/${p.progress.total}` : undefined}
              className={styles.arrive}
              style={vars({ "--n": LIVE_BLOCKS.findIndex((b) => b.title === p.id) })}
            />
          ))}
          {day === LANDING.day && <Landing hour={hour} clock={clock} scale={scale} />}
        </>
      ),
    };
  });

  return (
    <figure className={styles.figure} aria-labelledby="sample-caption">
      <div className={styles.caption}>
        <figcaption id="sample-caption" className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
          <span className="font-display text-lg font-medium text-ink">A sample day</span>
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

      <div className={styles.score} data-loop="" aria-hidden="true">
        <TimeGrid
          scale={scale}
          clock={clock}
          columns={columns}
          anyLabel="Any time"
          now={{ minutes: axisMinutes(into, hour), column: 0, label: formatMinutes(minutes, clock) }}
        />
        <div className={styles.tray}>
          <span className={styles.trayLabel}>Inbox</span>
          <ul className={styles.chips}>
            {LIVE_TRAY.map((title) => (
              <li key={title} className={title === LANDING.title ? styles.lifted : ""}>
                <MiniChip title={title} area={null} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LineKey />

      <div className="sr-only">
        {[0, 1, 2].map((day) => (
          <ul key={day} aria-label={DAY_NAMES[day]}>
            {LIVE_BLOCKS.filter((b) => b.day === day).map((b) => (
              <li key={b.title}>
                {b.title}, {wall(b.start)} to {wall(b.end)}, {b.area}, {STATE_WORD[stateOn(b, into)]}
                {b.progress && `, ${b.progress.done} of ${b.progress.total} subtasks done`}
              </li>
            ))}
            {LIVE_ANYTIME.filter((a) => a.day === day).map((a) => (
              <li key={a.title}>
                {a.title}, any time, {a.area}, planned
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

/** The loop's drop: a dashed verdigris ghost with its time, which then settles as a planned block. */
function Landing({ hour, clock, scale }: { hour: number; clock: Clock; scale: ReturnType<typeof scaleOf> }) {
  const start = axisMinutes(LANDING.start, hour);
  const end = axisMinutes(LANDING.end, hour);
  const [packed] = packSample([{ id: LANDING.title, title: LANDING.title, start, end }], scale);
  const place = { top: packed.top, height: packed.height };
  return (
    <>
      <div className={`${styles.ghost} tabular`} style={place}>
        {formatMinutes(start, clock)} to {formatMinutes(end, clock)}
      </div>
      <MiniBlock block={packed} clock={clock} area={LIVE_AREAS[LANDING.area]} state="planned" className={styles.landed} />
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
            <span className={`${styles.keyMark} ${styles[e.state]}`} aria-hidden="true" />
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
