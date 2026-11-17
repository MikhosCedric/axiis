"use client";

import { startTransition, useState, ViewTransition } from "react";
import { useClock } from "@/components/shell/clock-context";
import type { AreaColor } from "@/domain/area-color";
import { scaleOf } from "@/features/calendar/grid-layout";
import { Glyph } from "@/features/today/glyph";
import type { BeamState } from "@/features/today/model";
import { formatMinutes } from "@/lib/clock";
import { focusSplit, foldedLine, type DayRow } from "./demo-model";
import { packSample } from "./grid-pack";
import { MiniBlock, TimeGrid } from "./mini-grid";
import styles from "./demos.module.css";

const at = (h: number, m = 0) => h * 60 + m;
const NOW = at(11, 20);
const DAY: (DayRow & { area: AreaColor })[] = [
  { id: "run", title: "Easy run", start: at(7), end: at(7, 45), done: true, area: "sage" },
  { id: "summary", title: "Write the quarterly summary", start: at(8, 30), end: at(10), done: true, area: "indigo" },
  { id: "review", title: "Review Ana's draft", start: at(10, 45), end: at(12, 15), done: false, area: "indigo" },
  { id: "landlord", title: "Call the landlord", start: at(12, 30), end: at(12, 45), done: false, area: "ochre" },
  { id: "physio", title: "Physio exercises", start: at(13), end: at(13, 30), done: false, area: "sage" },
  { id: "plan", title: "Plan next week", start: at(14), end: at(15, 30), done: false, area: "indigo" },
  { id: "venue", title: "Reply to the venue", start: at(16), end: at(16, 30), done: false, area: "indigo" },
  { id: "groceries", title: "Groceries", start: at(17, 30), end: at(18, 15), done: false, area: "ochre" },
];
const SPLIT = focusSplit(DAY, NOW);
const SCALE = scaleOf(at(7), at(19), 40);
const BLOCKS = packSample(DAY, SCALE);

const stateOf = (r: DayRow): BeamState => (r.done ? "done" : r.start <= NOW && NOW < r.end ? "live" : "planned");

/** The day on the grid with Focus: on, everything but what is happening now steps back, and what is next is listed beside it. */
export function FocusDemo() {
  const clock = useClock();
  const [focus, setFocus] = useState(false);

  return (
    <div className={styles.demo}>
      <div className={styles.focusHead}>
        <span className="font-display text-[18px] font-medium text-ink">Today</span>
        <span className="text-ink-3 tabular">at {formatMinutes(NOW, clock)}</span>
        <button
          type="button"
          className={styles.focusToggle}
          aria-pressed={focus}
          onClick={() => startTransition(() => setFocus(!focus))}
        >
          Focus
        </button>
      </div>
      <div className={styles.focusBody}>
        <div aria-hidden="true">
          <TimeGrid
            scale={SCALE}
            clock={clock}
            dim={focus}
            columns={[
              {
                key: "day",
                today: true,
                children: BLOCKS.map((b) => {
                  const r = DAY.find((x) => x.id === b.id)!;
                  return <MiniBlock key={b.id} block={b} clock={clock} area={r.area} state={stateOf(r)} />;
                }),
              },
            ]}
            now={{ minutes: NOW, column: 0, label: formatMinutes(NOW, clock) }}
          />
        </div>
        <div className={styles.nextUp}>
          {focus ? (
            <ViewTransition enter="focus-in" exit="focus-out" default="none">
              <div>
                <p className={styles.nextTitle}>Next up</p>
                <ol className={styles.rows}>
                  {SPLIT.kept.map((r) => (
                    <li key={r.id} className={styles.row}>
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
                  ))}
                </ol>
                <p className={styles.foldNote}>
                  Dimmed on the day: <span className="tabular">{foldedLine(SPLIT)}</span>
                </p>
              </div>
            </ViewTransition>
          ) : (
            <p className={styles.foldNote}>Focus dims the day to what is happening now, and lists what is next.</p>
          )}
        </div>
      </div>
    </div>
  );
}
