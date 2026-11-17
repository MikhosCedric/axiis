"use client";

import { useId, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useClock } from "@/components/shell/clock-context";
import { scaleOf } from "@/features/calendar/grid-layout";
import { formatMinutes } from "@/lib/clock";
import { DRAG_AXIS, keySpan, moveBy, resizeBy, type Span } from "./demo-model";
import { packSample } from "./grid-pack";
import { MiniBlock, TimeGrid } from "./mini-grid";
import styles from "./demos.module.css";

const TITLE = "Plan next week";
const START: Span = { start: 14 * 60, end: 15 * 60 + 30 };
const HOUR_PX = 46;
const SCALE = scaleOf(DRAG_AXIS.start, DRAG_AXIS.end, HOUR_PX);

/** Two fixed neighbours, so the day looks like a day and the dragged block has something to move between. */
const NEIGHBOURS = [
  { id: "standup", title: "Stand-up", start: 9 * 60 + 30, end: 9 * 60 + 45 },
  { id: "lunch", title: "Lunch with Ana", start: 12 * 60 + 30, end: 13 * 60 + 30 },
  { id: "review", title: "Review Ana's draft", start: 10 * 60 + 45, end: 12 * 60 },
];

type Drag = { mode: "move" | "resize"; y: number; from: Span; pointer: number };


/**
 * One day of the grid and one block that drags like the app's: by its body to move it, by its bottom edge to
 * change its length, or with the keys (Alt and an arrow move it a quarter hour, Shift and an arrow change its end).
 */
export function DragDemo() {
  const clock = useClock();
  const id = useId();
  const [span, setSpan] = useState(START);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [said, setSaid] = useState("");

  const words = (s: Span) => `${formatMinutes(s.start, clock)} to ${formatMinutes(s.end, clock)}`;

  function begin(e: ReactPointerEvent<HTMLElement>, mode: Drag["mode"]) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ mode, y: e.clientY, from: span, pointer: e.pointerId });
  }

  function follow(e: ReactPointerEvent<HTMLElement>) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const minutes = (e.clientY - drag.y) / (HOUR_PX / 60);
    setSpan(drag.mode === "move" ? moveBy(drag.from, minutes) : resizeBy(drag.from, minutes));
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    if (!drag || e.pointerId !== drag.pointer) return;
    setDrag(null);
    setSaid(`${TITLE}, ${words(span)}.`);
  }

  function cancel(e: { pointerId?: number }) {
    if (drag && (e.pointerId === undefined || e.pointerId === drag.pointer)) {
      setSpan(drag.from);
      setDrag(null);
    }
  }

  const others = packSample(NEIGHBOURS, SCALE);
  const [mine] = packSample([{ id: "plan", title: TITLE, ...span }], SCALE);

  return (
    <div className={styles.demo}>
      <TimeGrid
        scale={SCALE}
        clock={clock}
        anyLabel="Any time"
        columns={[
          {
            key: "day",
            head: "Today",
            today: true,
            bodyProps: { className: drag ? styles.dropping : "" },
            children: (
              <>
                {others.map((b) => (
                  <MiniBlock key={b.id} block={b} clock={clock} area={b.id === "lunch" ? "ochre" : "indigo"} state="planned" />
                ))}
                <MiniBlock
                  block={mine}
                  clock={clock}
                  area="indigo"
                  state="planned"
                  hint={drag ? words(span) : undefined}
                  className={drag ? styles.dragging : ""}
                  style={drag ? { zIndex: 3 } : undefined}
                  face={{
                    "aria-label": `${TITLE}, ${words(span)}, Work, planned`,
                    "aria-describedby": `${id}-keys`,
                    "data-dragging": drag ? "" : undefined,
                    onPointerDown: (e) => begin(e, "move"),
                    onPointerMove: follow,
                    onPointerUp: end,
                    onPointerCancel: cancel,
                    onKeyDown: (e) => {
                      if (e.key === "Escape" && drag) {
                        cancel({});
                        return;
                      }
                      const next = keySpan(span, e.key, e.shiftKey, e.altKey);
                      if (!next) return;
                      e.preventDefault();
                      setSpan(next);
                      setSaid(`${TITLE}, ${words(next)}.`);
                    },
                  }}
                  extra={
                    <span
                      className={styles.grip}
                      aria-hidden="true"
                      onPointerDown={(e) => begin(e, "resize")}
                      onPointerMove={follow}
                      onPointerUp={end}
                      onPointerCancel={cancel}
                    />
                  }
                />
              </>
            ),
          },
        ]}
      />
      <p id={`${id}-keys`} className={styles.keysLine}>
        Drag the block, or its bottom edge. With it focused, <kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd> move it a quarter hour and{" "}
        <kbd>Shift</kbd> with an arrow changes its end.
      </p>
      <p role="status" className={styles.status}>
        {said}
      </p>
    </div>
  );
}
