"use client";

import { useState } from "react";
import { useClock } from "@/components/shell/clock-context";
import type { AreaColor } from "@/domain/area-color";
import { scaleOf } from "@/features/calendar/grid-layout";
import { Glyph } from "@/features/today/glyph";
import type { BeamState } from "@/features/today/model";
import { formatMinutes } from "@/lib/clock";
import { packSample } from "./grid-pack";
import { MiniBlock, TimeGrid } from "./mini-grid";
import styles from "./demos.module.css";

type Row = { id: string; title: string; start: number; end: number; open: Exclude<BeamState, "done">; area: AreaColor };

const ROWS: Row[] = [
  { id: "plants", title: "Water the plants", start: 7 * 60 + 30, end: 7 * 60 + 45, open: "planned", area: "ochre" },
  { id: "review", title: "Review Ana's draft", start: 9 * 60 + 45, end: 11 * 60 + 15, open: "live", area: "indigo" },
  { id: "landlord", title: "Call the landlord", start: 12 * 60 + 30, end: 13 * 60, open: "planned", area: "ochre" },
];
const SCALE = scaleOf(7 * 60, 14 * 60, 44);
/** Where now is for the demo: inside the live row. */
const NOW = 10 * 60 + 30;

/**
 * A day of the grid and the same items as rows. Each row's glyph is its done box, as on the app's lists: ticking
 * it turns the block hollow (faded, its title struck); unticking gives back its line.
 */
export function DoneDemo() {
  const clock = useClock();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set(["plants"]));
  const [justDone, setJustDone] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const state = (r: Row): BeamState => (done.has(r.id) ? "done" : r.open);
  const blocks = packSample(ROWS, SCALE);

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
      <div aria-hidden="true">
        <TimeGrid
          scale={SCALE}
          clock={clock}
          columns={[
            {
              key: "day",
              head: "Today",
              today: true,
              children: blocks.map((b) => {
                const r = ROWS.find((x) => x.id === b.id)!;
                return <MiniBlock key={b.id} block={b} clock={clock} area={r.area} state={state(r)} />;
              }),
            },
          ]}
          now={{ minutes: NOW, column: 0, label: formatMinutes(NOW, clock) }}
        />
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
