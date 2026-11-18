import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import type { AreaColor } from "@/domain/area-color";
import { MIN_BLOCK_PX, blockBox, gridHeight, yAt, type Scale } from "@/features/calendar/grid-layout";
import type { BeamState } from "@/features/today/model";
import { formatHour, formatMinutes, type Clock } from "@/lib/clock";
import type { Packed, SampleBlock } from "./grid-pack";
import styles from "./mini-grid.module.css";

const vars = (v: Record<string, number | string>) => v as CSSProperties;

export type GridColumn = {
  key: string;
  /** The day's name over the column, as the top bar's days read: "Wed 4". */
  head?: string;
  today?: boolean;
  /** Drawn in the Any time row over the column. */
  anyTime?: ReactNode;
  /** Hidden under 640px, so a phone keeps the first columns, as the app's Week does. */
  extra?: boolean;
  bodyRef?: Ref<HTMLDivElement>;
  bodyProps?: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string | undefined };
  children: ReactNode;
};

export type GridNow = { minutes: number; column: number; label: string };

/**
 * A small time grid in the app's own shape: hours down a gutter, days as columns, an Any time row above, and
 * the verdigris line for now with a dot on today's column. It only places what it is given; the scale is the
 * real grid's (`scaleOf`, `yAt`), so a block's top and height are the app's own sums.
 */
export function TimeGrid({
  scale,
  clock,
  columns,
  now,
  anyLabel,
  className = "",
  dim = false,
}: {
  scale: Scale;
  clock: Clock;
  columns: GridColumn[];
  now?: GridNow | null;
  /** Shows the Any time row, with this label. */
  anyLabel?: string;
  className?: string;
  /** Focus: everything but what is happening now steps back. */
  dim?: boolean;
}) {
  const firstHour = Math.ceil(scale.from / 60);
  const lastHour = Math.floor(scale.to / 60);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const heads = columns.some((c) => c.head);
  const hasExtra = columns.some((c) => c.extra);
  return (
    <div
      className={`${styles.grid} ${hasExtra ? styles.hasExtra : ""} ${dim ? styles.dim : ""} ${className}`}
      style={vars({ "--cols": columns.length, "--hour": `${scale.ppm * 60}px`, "--height": `${gridHeight(scale)}px` })}
    >
      {heads && <span className={styles.corner} />}
      {anyLabel && <span className={styles.anyLabel}>{anyLabel}</span>}
      <div className={styles.gutter}>
        {hours.map((h) =>
          h * 60 === scale.from ? null : (
            <span key={h} className={`${styles.hourLabel} tabular`} style={{ top: yAt(h * 60, scale) }}>
              {formatHour(h, clock)}
            </span>
          ),
        )}
        {now && (
          <span className={`${styles.hourLabel} ${styles.nowLabel} tabular`} style={{ top: yAt(now.minutes, scale) }}>
            {now.label}
          </span>
        )}
      </div>
      {columns.map((c, i) => (
        <div key={c.key} className={`${styles.col} ${c.extra ? styles.extra : ""}`} style={{ gridColumn: i + 2 }}>
          {c.head && (
            <span className={styles.head} data-today={c.today ? "" : undefined}>
              {c.head}
            </span>
          )}
          {anyLabel && <div className={styles.any}>{c.anyTime}</div>}
          <div
            {...c.bodyProps}
            ref={c.bodyRef}
            className={`${styles.body} ${c.today ? styles.bodyToday : ""} ${c.bodyProps?.className ?? ""}`}
          >
            {c.children}
            {now && now.column === i && (
              <span className={styles.now} style={vars({ "--y": `${yAt(now.minutes, scale)}px` })}>
                <i />
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type FaceProps = ButtonHTMLAttributes<HTMLButtonElement> & { [data: `data-${string}`]: string | undefined };

/**
 * One block: the area's colour as a soft tint, the line form as the small mark at its left (dashed planned, solid
 * live, hollow done), its title and its time. With `face` it is a button, for the demos that move it.
 */
export function MiniBlock({
  block,
  clock,
  area,
  state,
  face,
  extra,
  hint,
  className = "",
  style,
}: {
  block: Packed<SampleBlock>;
  clock: Clock;
  area: AreaColor | null;
  state: BeamState;
  face?: FaceProps;
  /** Beside the title, after the time: a subtask count. */
  hint?: string;
  /** Inside the block after its face: the resize grip. */
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { left, width } = blockBox(block);
  const short = block.height < 44;
  const time = formatMinutes(block.start, clock);
  const words = (
    <>
      <span className={styles.mark} aria-hidden="true">
        <i />
      </span>
      <span className={styles.words}>
        <span className={styles.title}>{block.title}</span>
        {/* A real space between the title and the time, so the visible words read "Title 14:00" to a checker (WCAG 2.5.3) and the button's name, "Title, 14:00 to 15:30, ...", contains them. */}
        {" "}
        {hint && <span className={`${styles.meta} ${styles.inline}`}> {hint}</span>}
        <span className={`${styles.meta} ${short ? styles.inline : ""}`}>
          {short ? " " : ""}
          {time}
        </span>
      </span>
    </>
  );
  return (
    <div
      className={`${styles.block} ${styles[state]} ${short ? styles.short : ""} ${area ? "" : styles.plain} ${className}`}
      style={{
        ...vars({ "--tint": area ? `var(--area-${area})` : "var(--ink)" }),
        top: block.top,
        height: Math.max(MIN_BLOCK_PX, block.height),
        left: `calc(${left * 100}% + 1px)`,
        width: `calc(${width * 100}% - 3px)`,
        ...style,
      }}
    >
      {face ? (
        <button type="button" {...face} className={`${styles.face} ${styles.faceButton} ${face.className ?? ""}`}>
          {words}
        </button>
      ) : (
        <span className={styles.face}>{words}</span>
      )}
      {extra}
    </div>
  );
}

/** A chip in the Any time row or the Inbox tray: the same tint, one line, the same mark. */
export function MiniChip({ title, area, state = "planned", className = "" }: { title: string; area: AreaColor | null; state?: BeamState; className?: string }) {
  return (
    <span
      className={`${styles.chip} ${styles[state]} ${area ? "" : styles.plain} ${className}`}
      style={vars({ "--tint": area ? `var(--area-${area})` : "var(--ink)" })}
    >
      <span className={styles.mark} aria-hidden="true">
        <i />
      </span>
      <span className={styles.chipTitle}>{title}</span>
    </span>
  );
}
