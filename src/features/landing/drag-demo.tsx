"use client";

import { useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import { formatHour, formatMinutes } from "@/lib/clock";
import { DRAG_AXIS, keySpan, moveBy, resizeBy, type Span } from "./demo-model";
import styles from "./demos.module.css";

const TITLE = "Plan next week";
const START: Span = { start: 14 * 60, end: 15 * 60 + 30 };
const AXIS_MINUTES = DRAG_AXIS.end - DRAG_AXIS.start;
const HOURS = Array.from({ length: AXIS_MINUTES / 60 + 1 }, (_, i) => DRAG_AXIS.start / 60 + i);

type Drag = { mode: "move" | "resize"; x: number; from: Span; width: number; pointer: number };

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/** One staff and one beam that drags like the Score's: along the line to move it, by its right end to change its length, or by the arrow keys. */
export function DragDemo() {
  const clock = useClock();
  const id = useId();
  const [span, setSpan] = useState(START);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [said, setSaid] = useState("");
  const track = useRef<HTMLDivElement>(null);

  const words = (s: Span) => `${formatMinutes(s.start, clock)} to ${formatMinutes(s.end, clock)}`;

  function begin(e: ReactPointerEvent<HTMLElement>, mode: Drag["mode"]) {
    if (e.button !== 0 || !track.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ mode, x: e.clientX, from: span, width: track.current.clientWidth, pointer: e.pointerId });
  }

  function follow(e: ReactPointerEvent<HTMLElement>) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const minutes = ((e.clientX - drag.x) / drag.width) * AXIS_MINUTES;
    setSpan(drag.mode === "move" ? moveBy(drag.from, minutes) : resizeBy(drag.from, minutes));
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    if (!drag || e.pointerId !== drag.pointer) return;
    setDrag(null);
    setSaid(`${TITLE}, ${words(span)}.`);
  }

  return (
    <div className={styles.demo}>
      <div className={styles.dragScore} style={vars({ "--span": AXIS_MINUTES / 60 })}>
        <div className={styles.landAxis} aria-hidden="true">
          <span className={styles.landName} />
          <div className={styles.landTrack}>
            {HOURS.map((h, i) => (
              <span key={h} className={`${styles.landTick} ${i % 2 ? styles.oddTick : ""} tabular`} style={vars({ "--h": i })}>
                {formatHour(h, clock)}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.landRow}>
          <span className={styles.landName} aria-hidden="true">
            Work
          </span>
          <div ref={track} className={`${styles.landTrack} ${styles.landStaff} ${drag ? styles.dropping : ""}`}>
            <div
              className={styles.landMover}
              data-dragging={drag ? "" : undefined}
              style={vars({
                "--at": (span.start - DRAG_AXIS.start) / AXIS_MINUTES,
                "--len": (span.end - span.start) / AXIS_MINUTES,
              })}
            >
              <button
                type="button"
                className={`${styles.landBeam} ${styles.dragBeam} ${drag ? styles.ghosted : ""}`}
                aria-label={`${TITLE} ${words(span)}`}
                aria-describedby={`${id}-keys`}
                onPointerDown={(e) => begin(e, "move")}
                onPointerMove={follow}
                onPointerUp={end}
                onPointerCancel={(e) => {
                  if (drag && e.pointerId === drag.pointer) {
                    setSpan(drag.from);
                    setDrag(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && drag) {
                    setSpan(drag.from);
                    setDrag(null);
                    return;
                  }
                  const next = keySpan(span, e.key, e.shiftKey);
                  if (!next) return;
                  e.preventDefault();
                  setSpan(next);
                  setSaid(`${TITLE}, ${words(next)}.`);
                }}
              >
                <span className={`${styles.landLabel} ${drag ? styles.dragTip : ""}`}>
                  {drag ? (
                    <span className="tabular">{words(span)}</span>
                  ) : (
                    <>
                      {TITLE}
                      <span className={styles.landClock}>{formatMinutes(span.start, clock)}</span>
                    </>
                  )}
                </span>
                <Glyph type="task" state="planned" className={styles.landGlyph} />
                <span
                  className={styles.grip}
                  aria-hidden="true"
                  onPointerDown={(e) => begin(e, "resize")}
                  onPointerMove={follow}
                  onPointerUp={end}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      <p id={`${id}-keys`} className={styles.keysLine}>
        Drag the beam, or its right end. With it focused, <kbd>←</kbd> <kbd>→</kbd> move it a quarter hour and{" "}
        <kbd>Shift</kbd> with an arrow changes its end.
      </p>
      <p role="status" className={styles.status}>
        {said}
      </p>
    </div>
  );
}
