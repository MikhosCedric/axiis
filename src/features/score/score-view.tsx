"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { repeats, type Area, type LocalDate, type ShownItem } from "@/domain/item";
import { RepeatMark } from "@/features/today/repeat-mark";
import { tagLine } from "@/features/tags/model";
import { RowTags } from "@/features/tags/row-tags";
import { formatClock } from "@/features/today/format";
import { Glyph } from "@/features/today/glyph";
import { EMPTY_TRAY, type BeamState, type TodayEntry, type TodayView } from "@/features/today/model";
import { instantAt, localMinutes } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";
import { keyPlacement, type DropContext, type Placement } from "./drop";
import {
  axisWidth,
  beamTop,
  hourTicks,
  labelWidth,
  layoutScore,
  PX_PER_MINUTE,
  spanOf,
  xAt,
  type Beam,
  type Staff,
} from "./layout";
import styles from "./score.module.css";
import { useScoreDrag, type DragPreview } from "./use-score-drag";

export type ScoreHandlers = {
  onSelect: (id: string | null) => void;
  onPlace: (item: ShownItem, placement: Placement) => void;
  onToggleDone: (item: ShownItem) => void;
};

export const STATE_WORD: Record<BeamState, string> = { planned: "planned", live: "happening now", done: "done" };

const KEYS_ID = "score-keys";

export function ScoreView({
  view,
  areas,
  date,
  timeZone,
  nowMinutes,
  childCounts,
  tags,
  selectedId,
  justDone,
  onSelect,
  onPlace,
  onToggleDone,
}: {
  view: TodayView;
  areas: Area[];
  date: LocalDate;
  timeZone: string;
  /** Local minutes of now when the day shown is today, else null. */
  nowMinutes: number | null;
  childCounts: Record<string, ChildCount>;
  /** Tag names by shown id. Beams are too tight for them, so only their labels say them; chips show them. */
  tags: Record<string, readonly string[]>;
  selectedId: string | null;
  justDone: string | null;
} & ScoreHandlers) {
  const root = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);

  const [preview, setPreview] = useState<DragPreview | null>(null);
  const target = preview?.target ?? null;
  const landing = target?.kind === "staff" ? target.placement : null;

  const score = useMemo(() => {
    const s = landing?.schedule;
    const pending =
      preview && s?.kind === "timed"
        ? {
            itemId: preview.item.id,
            areaId: landing!.areaId ?? null,
            span: { start: localMinutes(s.start, date, timeZone), end: localMinutes(s.end, date, timeZone) },
          }
        : null;
    return layoutScore({ view, areas, date, timeZone, now: nowMinutes, pending });
  }, [view, areas, date, timeZone, nowMinutes, preview, landing]);
  const { axis, staves } = score;
  const ctx: DropContext = { date, timeZone, axis, now: nowMinutes };
  const start = useScoreDrag(
    { scroller, layer, tray, anyTime: strip, fly },
    {
      ctx,
      staves,
      labelWidth: () => root.current?.querySelector<HTMLElement>("[data-staff-label]")?.offsetWidth ?? 0,
      onDrop: onPlace,
      onTap: (item) => onSelect(item.id),
    },
    setPreview,
  );
  const width = axisWidth(axis);
  const totalHeight = staves.reduce((h, s) => h + s.height + 1, 0);
  const areaName = (item: ShownItem) => staves.find((s) => s.areaId === item.areaId)?.name ?? "No area";

  function syncAxis() {
    if (ticks.current && scroller.current) ticks.current.style.transform = `translateX(${-scroller.current.scrollLeft}px)`;
  }

  // Open on now, or on the first beam, rather than on the empty early morning.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const label = root.current?.querySelector<HTMLElement>("[data-staff-label]")?.offsetWidth ?? 0;
    const visible = el.clientWidth - label;
    const first = Math.min(...staves.flatMap((s) => s.beams.map((b) => b.span.start)));
    const focus = nowMinutes !== null ? xAt(axis, nowMinutes) - 0.3 * visible : Number.isFinite(first) ? xAt(axis, first) - 24 : 0;
    el.scrollLeft = Math.max(0, focus);
    syncAxis();
    // Only on first paint: later renders keep wherever the person scrolled to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-item="${id}"]`);
    if (el && document.activeElement !== el) el.focus();
    if (el) refocus.current = null;
  });

  function keyDown(e: KeyboardEvent<HTMLElement>, item: ShownItem) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSelect(item.id);
    } else if (e.key === " ") {
      e.preventDefault();
      onToggleDone(item);
    } else if (e.key === "Escape") {
      onSelect(null);
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const placement = keyPlacement(ctx, item, score.areaOrder, e);
      if (!placement) return;
      e.preventDefault();
      refocus.current = item.id;
      onPlace(item, placement);
    }
  }

  // Over a staff the ghost shows where the item will land, so the floating copy would only hide it.
  const showFly = preview !== null && preview.kind !== "resize" && target?.kind !== "staff";

  return (
    <section ref={root} aria-labelledby="score-h" className="[--lw:80px] rail:[--lw:104px]">
      <h2 id="score-h" className="sr-only">
        Score
      </h2>

      <div
        ref={strip}
        className={`mb-3 flex items-start border-y border-rule ${target?.kind === "anytime" ? "bg-accent-wash" : ""}`}
      >
        <h3 className="w-[var(--lw)] flex-none border-r border-rule px-2 py-3 font-serif text-base leading-tight font-medium rail:px-3">
          Any time
        </h3>
        {score.anyTime.length ? (
          <ul className="flex min-w-0 flex-wrap gap-2.5 p-2.5" aria-label="Any time today">
            {score.anyTime.map((entry) => (
              <li key={entry.item.id} className="min-w-0">
                <Chip
                  entry={entry}
                  count={childCounts[entry.item.id]}
                  tags={tags[entry.item.id]}
                  selected={selectedId === entry.item.id}
                  justDone={justDone === entry.item.id}
                  lifted={preview?.item.id === entry.item.id && preview.kind !== "resize"}
                  where="any time"
                  onPointerDown={(e) => start(e, "place", entry.item)}
                  onKeyDown={(e) => keyDown(e, entry.item)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-[13px] text-ink-3">For things that belong to the day but not to an hour.</p>
        )}
      </div>

      <div className="sticky top-0 z-10 flex h-[34px] border-y border-rule bg-paper" aria-hidden="true">
        <div className="w-[var(--lw)] flex-none border-r border-rule" />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={ticks} className="absolute inset-y-0 left-0" style={{ width }}>
            {hourTicks(axis).map((m) => (
              <span
                key={m}
                className="absolute inset-y-0 border-l border-rule pt-[9px] pl-1.5 text-xs leading-none font-medium text-ink-3 tabular"
                style={{ left: xAt(axis, m) }}
              >
                {String(Math.floor(m / 60) % 24).padStart(2, "0")}
              </span>
            ))}
            {nowMinutes !== null && nowMinutes >= axis.start && nowMinutes <= axis.end && (
              <span
                className="absolute top-[5px] z-[1] -translate-x-1/2 rounded bg-accent px-1.5 py-1 text-xs leading-none font-semibold text-on-accent tabular"
                style={{ left: xAt(axis, nowMinutes) }}
              >
                {formatClock(instantAt(date, nowMinutes, timeZone), timeZone)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div ref={scroller} onScroll={syncAxis} className="overflow-x-auto overflow-y-hidden border-b border-rule">
        <div className="relative" style={{ width: `calc(var(--lw) + ${width}px)` }}>
          {staves.map((staff, i) => (
            <div key={staff.areaId ?? "none"} className="flex border-b border-rule last:border-b-0">
              <div
                data-staff-label
                className="sticky left-0 z-[4] w-[var(--lw)] flex-none border-r border-rule bg-paper px-2 py-3.5 rail:px-3"
              >
                <span className="block font-serif text-base leading-tight font-medium [overflow-wrap:anywhere] rail:text-[19px]">
                  {staff.name}
                </span>
                <span className="mt-1 block text-xs text-ink-3">{staff.open} open</span>
              </div>
              <div
                className={`${styles.staffBody} ${target?.kind === "staff" && target.staff === i ? styles.over : ""}`}
                style={{ width, height: staff.height }}
              >
                {Array.from({ length: staff.rows }, (_, r) => (
                  <div key={r} className={styles.lines} style={{ top: beamTop(r) }} />
                ))}
              </div>
            </div>
          ))}

          <div ref={layer} className="absolute top-0 left-[var(--lw)]" style={{ width, height: totalHeight }}>
            {staves.flatMap((staff) =>
              staff.beams.map((beam) => (
                <BeamView
                  key={beam.value.item.id}
                  beam={beam}
                  staff={staff}
                  ctx={ctx}
                  preview={preview}
                  count={childCounts[beam.value.item.id]}
                  tags={tags[beam.value.item.id]}
                  selected={selectedId === beam.value.item.id}
                  justDone={justDone === beam.value.item.id}
                  onPointerDown={(e, kind) => start(e, kind, beam.value.item)}
                  onKeyDown={(e) => keyDown(e, beam.value.item)}
                />
              )),
            )}
            {score.ghost && landing && (
              <Ghost top={staves[score.ghost.staff].top + beamTop(score.ghost.row)} placement={landing} ctx={ctx} />
            )}
            {nowMinutes !== null && nowMinutes >= axis.start && nowMinutes <= axis.end && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-[3] -ml-px w-0.5 bg-accent"
                style={{ left: xAt(axis, nowMinutes) }}
              />
            )}
          </div>
        </div>
      </div>

      <p aria-hidden="true" className="mt-3 hidden text-[13px] leading-relaxed text-ink-3 pointer-coarse:block">
        Press and hold a beam, then drag it to move it, or hold and drag its right end to change its length.
      </p>
      {/* Touch screens see the line above instead; this stays as every beam's description for keyboard users. */}
      <p id={KEYS_ID} className="mt-3 max-w-[72ch] text-[13px] leading-relaxed text-ink-3 pointer-coarse:sr-only">
        Drag a beam to move it, or its right end to change its length. With a beam focused, <Kbd>←</Kbd> <Kbd>→</Kbd>{" "}
        move it a quarter hour, <Kbd>Shift</Kbd> with <Kbd>←</Kbd> <Kbd>→</Kbd> changes its length, <Kbd>↑</Kbd>{" "}
        <Kbd>↓</Kbd> change its area, <Kbd>Space</Kbd> marks it done, <Kbd>Enter</Kbd> opens it and <Kbd>Backspace</Kbd>{" "}
        sends it back to waiting. On a waiting item, <Kbd>↑</Kbd> or <Kbd>↓</Kbd> gives it a time.
      </p>

      <section
        ref={tray}
        aria-labelledby="tray-h"
        className={`mt-7 pt-2 ${target?.kind === "tray" ? styles.dropZone : ""}`}
      >
        <h3 id="tray-h" className="font-serif text-lg leading-tight font-medium">
          Waiting for a time
        </h3>
        <p className="mt-1 mb-3.5 text-[13px] text-ink-3">
          <span className="pointer-coarse:hidden">Drag one onto an area to give it a time.</span>
          <span className="hidden pointer-coarse:inline">Press and hold one, then drag it onto an area to give it a time.</span>{" "}
          Drag a beam back here to clear its time.
        </p>
        {score.waiting.length ? (
          <ul className="flex flex-wrap gap-2.5">
            {score.waiting.map((entry) => (
              <li key={entry.item.id} className="min-w-0">
                <Chip
                  entry={entry}
                  count={childCounts[entry.item.id]}
                  tags={tags[entry.item.id]}
                  selected={selectedId === entry.item.id}
                  justDone={justDone === entry.item.id}
                  lifted={preview?.item.id === entry.item.id && preview.kind !== "resize"}
                  where={entry.item.areaId ? `waiting, ${areaName(entry.item)}` : "waiting"}
                  onPointerDown={(e) => start(e, "place", entry.item)}
                  onKeyDown={(e) => keyDown(e, entry.item)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">{EMPTY_TRAY}</p>
        )}
      </section>

      <div ref={fly} hidden={!showFly} className={`${styles.chip} ${styles.fly}`} aria-hidden="true">
        {preview && (
          <>
            <Glyph type={preview.item.type} state="planned" className={styles.glyph} />
            <span className="max-w-[24ch] truncate">{preview.item.title}</span>
          </>
        )}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-rule px-1 font-sans text-xs font-semibold text-ink-2">{children}</kbd>
  );
}

function progress(count: ChildCount | undefined) {
  return count ? { text: `${count.done}/${count.total}`, spoken: `${count.done} of ${count.total} subtasks done` } : null;
}

function BeamView({
  beam,
  staff,
  ctx,
  preview,
  count,
  tags,
  selected,
  justDone,
  onPointerDown,
  onKeyDown,
}: {
  beam: Beam;
  staff: Staff;
  ctx: DropContext;
  preview: DragPreview | null;
  count: ChildCount | undefined;
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, kind: "move" | "resize") => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const { item, state } = beam.value;
  const mine = preview?.item.id === item.id;
  const resizing = mine && preview.kind === "resize" && preview.target?.kind === "resize";
  const span = (resizing && spanOf({ ...item, schedule: preview.target!.placement.schedule }, ctx.date, ctx.timeZone)) || beam.span;
  const startClock = formatClock(minutesToDate(ctx, span.start), ctx.timeZone);
  const endClock = formatClock(minutesToDate(ctx, span.end), ctx.timeZone);
  const p = progress(count);
  const cls = [
    styles.beam,
    styles[state],
    selected ? styles.selected : "",
    mine && preview.kind === "move" ? styles.lifted : "",
    mine ? styles.tracking : "",
  ].join(" ");

  return (
    <div
      data-item={item.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}, ${startClock} to ${endClock}, ${staff.name}, ${STATE_WORD[state]}${repeats(item) ? ", repeats" : ""}${p ? `, ${p.spoken}` : ""}${spokenTags(tags)}`}
      aria-describedby={KEYS_ID}
      className={cls}
      style={{
        left: xAt(ctx.axis, span.start),
        top: staff.top + beamTop(beam.row),
        width: Math.max(14, (span.end - span.start) * PX_PER_MINUTE),
      }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onKeyDown={onKeyDown}
    >
      <span className={styles.label} style={{ maxWidth: labelWidth(beam.free) }} title={item.title}>
        {item.title}
        {repeats(item) && <RepeatMark className={styles.repeat} />}
        {p && <span className={styles.count}>{p.text}</span>}
        <time className={styles.clock} dateTime={minutesToDate(ctx, span.start).toISOString()}>
          {resizing ? `${startClock} to ${endClock}` : startClock}
        </time>
      </span>
      <ViewTransition name={`item-${item.id}`} share="morph" default="none">
        <Glyph type={item.type} state={state} justDone={justDone} className={styles.glyph} />
      </ViewTransition>
      <span className={styles.grip} aria-hidden="true" onPointerDown={(e) => onPointerDown(e, "resize")} />
    </div>
  );
}

function minutesToDate(ctx: DropContext, minutes: number) {
  return instantAt(ctx.date, minutes, ctx.timeZone);
}

function Ghost({ top, placement, ctx }: { top: number; placement: Placement; ctx: DropContext }) {
  const s = placement.schedule;
  if (s.kind !== "timed") return null;
  const start = localMinutes(s.start, ctx.date, ctx.timeZone);
  const end = localMinutes(s.end, ctx.date, ctx.timeZone);
  return (
    <div
      className={styles.ghost}
      style={{ left: xAt(ctx.axis, start), width: (end - start) * PX_PER_MINUTE, top }}
    >
      <span className={`${styles.tip} tabular`}>
        {formatClock(s.start, ctx.timeZone)} to {formatClock(s.end, ctx.timeZone)}
      </span>
    </div>
  );
}

function spokenTags(tags: readonly string[] | undefined) {
  const { spoken } = tagLine(tags ?? []);
  return spoken ? `, ${spoken}` : "";
}

function Chip({
  entry,
  count,
  tags,
  selected,
  justDone,
  lifted,
  where,
  onPointerDown,
  onKeyDown,
}: {
  entry: TodayEntry;
  count: ChildCount | undefined;
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  lifted: boolean;
  where: string;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const { item, state } = entry;
  const p = progress(count);
  return (
    <div
      data-item={item.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}, ${where}, ${STATE_WORD[state]}${repeats(item) ? ", repeats" : ""}${p ? `, ${p.spoken}` : ""}${spokenTags(tags)}`}
      aria-describedby={KEYS_ID}
      className={`${styles.chip} ${selected ? styles.selected : ""} ${state === "done" ? styles.done : ""} ${lifted ? styles.lifted : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <ViewTransition name={`item-${item.id}`} share="morph" default="none">
        <Glyph type={item.type} state={state} justDone={justDone} className={styles.glyph} />
      </ViewTransition>
      <span className="min-w-0 truncate">{item.title}</span>
      {repeats(item) && <RepeatMark className="text-ink-3" />}
      {p && <span className={styles.count}>{p.text}</span>}
      <RowTags tags={tags} max={2} className="whitespace-nowrap" />
    </div>
  );
}
