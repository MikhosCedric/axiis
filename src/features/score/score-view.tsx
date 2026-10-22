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
  type ReactNode,
} from "react";
import { AreaMark } from "@/components/area-mark";
import type { AreaColor } from "@/domain/area-color";
import { repeats, type Area, type LocalDate, type ShownItem } from "@/domain/item";
import { RepeatMark } from "@/features/today/repeat-mark";
import { tagLine } from "@/features/tags/model";
import { RowTags } from "@/features/tags/row-tags";
import { formatClock, formatHour } from "@/lib/clock";
import { useClock } from "@/components/shell/clock-context";
import { Glyph } from "@/features/today/glyph";
import { DueMark } from "@/features/today/due-mark";
import { dueWords } from "@/features/today/due";
import { LineLegend } from "@/features/today/line-legend";
import { SameInInbox } from "@/features/inbox/same-in-inbox";
import { EMPTY_TRAY, TRAY_FULL, INBOX,type BeamState, type TodayEntry, type TodayView } from "@/features/today/model";
import { instantAt, localMinutes } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";
import { keyPlacement, type DropContext, type Placement } from "./drop";
import {
  axisWidth,
  beamTop,
  hourTicks,
  HOUR_PX,
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
import { exampleBeams, EXAMPLES_NOTE, type ExampleBeam } from "@/features/day/first-day";

export type ScoreHandlers = {
  onSelect: (id: string | null) => void;
  onPlace: (item: ShownItem, placement: Placement) => void;
  onToggleDone: (item: ShownItem) => void;
};

export const STATE_WORD: Record<BeamState, string> = { planned: "planned", live: "happening now", done: "done" };

/** Where beams are drawn, and the real today, which a due date is read from even on another day. */
type BeamContext = DropContext & { today: LocalDate };

const KEYS_ID = "score-keys";

export function ScoreView({
  view,
  waitingFull,
  areas,
  date,
  today,
  timeZone,
  nowMinutes,
  childCounts,
  tags,
  selectedId,
  justDone,
  firstDay = false,
  onSelect,
  onPlace,
  onToggleDone,
}: {
  view: TodayView;
  /** The account has never stored an item: draw example beams and leave out what only explains items. */
  firstDay?: boolean;
  waitingFull: boolean;
  areas: Area[];
  date: LocalDate;
  /** The real today, for due marks. */
  today: LocalDate;
  timeZone: string;
  /** Local minutes of now when the day shown is today, else null. */
  nowMinutes: number | null;
  childCounts: Record<string, ChildCount>;
  /** Tag names by shown id. Beams are too tight for them, so only their labels say them; chips show them. */
  tags: Record<string, readonly string[]>;
  selectedId: string | null;
  justDone: string | null;
} & ScoreHandlers) {
  const clock = useClock();
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

  // Pixels the axis has beside the label column. 0 until measured, which draws the default axis, as on the server.
  const [measured, setMeasured] = useState(0);
  // A drag keeps the axis it started on, so a resize mid-gesture never moves what is held.
  const [room, setRoom] = useState(0);
  if (preview === null && room !== measured) setRoom(measured);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const label = root.current?.querySelector<HTMLElement>("[data-staff-label]")?.offsetWidth ?? 0;
      setMeasured(Math.max(0, el.clientWidth - label));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    return layoutScore({ view, areas, date, timeZone, now: nowMinutes, pending, room });
  }, [view, areas, date, timeZone, nowMinutes, preview, landing, room]);
  const { axis, staves } = score;
  const examples = useMemo(() => (firstDay ? exampleBeams(areas) : []), [firstDay, areas]);
  const empty = staves.every((s) => s.beams.length === 0);
  const ctx: BeamContext = { date, timeZone, axis, now: nowMinutes, today };
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
  const colorOf = (item: ShownItem) => staves.find((s) => s.areaId === item.areaId)?.color ?? null;

  function syncAxis() {
    if (ticks.current && scroller.current) ticks.current.style.transform = `translateX(${-scroller.current.scrollLeft}px)`;
  }

  // Open on now, or on the first beam, rather than on the empty early morning.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const label = root.current?.querySelector<HTMLElement>("[data-staff-label]")?.offsetWidth ?? 0;
    const visible = el.clientWidth - label;
    const first = Math.min(...staves.flatMap((s) => s.beams.map((b) => b.span.start)), ...examples.map((e) => e.span.start));
    // An empty first day opens on its examples, which show what the Score is for better than the time does.
    const focus =
      nowMinutes !== null && !examples.length ? xAt(axis, nowMinutes) - 0.3 * visible : Number.isFinite(first) ? xAt(axis, first) - 24 : 0;
    // On a whole hour, so the first label shows whole: a clipped "9 AM" would read as "AM".
    el.scrollLeft = Math.floor(Math.max(0, Math.min(focus, el.scrollWidth - el.clientWidth)) / HOUR_PX) * HOUR_PX;
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

  const chip = (entry: TodayEntry, where: string) => (
    <li key={entry.item.id} className="min-w-0">
      <Chip
        entry={entry}
        count={childCounts[entry.item.id]}
        tags={tags[entry.item.id]}
        today={today}
        selected={selectedId === entry.item.id}
        justDone={justDone === entry.item.id}
        lifted={preview?.item.id === entry.item.id && preview.kind !== "resize"}
        where={entry.item.areaId ? `${where}, ${areaName(entry.item)}` : where}
        color={colorOf(entry.item)}
        onPointerDown={(e) => start(e, "place", entry.item)}
        onKeyDown={(e) => keyDown(e, entry.item)}
      />
    </li>
  );

  /** Open chips, then the done ones folded into one quiet "Done (n)". A chip just ticked stays put until it settles. */
  function chips(entries: TodayEntry[], where: string) {
    const done = entries.filter((e) => e.state === "done" && e.item.id !== justDone && e.item.id !== selectedId);
    const open = entries.filter((e) => !done.includes(e));
    return (
      <>
        {open.map((e) => chip(e, where))}
        {done.length > 0 && (
          <li className="min-w-0">
            <DoneFold count={done.length}>{done.map((e) => chip(e, where))}</DoneFold>
          </li>
        )}
      </>
    );
  }

  // Over a staff the ghost shows where the item will land, so the floating copy would only hide it.
  const showFly = preview !== null && preview.kind !== "resize" && target?.kind !== "staff";

  return (
    <section ref={root} aria-labelledby="score-h" className="[--lw:80px] rail:[--lw:104px]">
      <h2 id="score-h" className="sr-only">
        Score
      </h2>

      {!firstDay && (
        <div
          ref={strip}
          className={`mb-3 flex items-start border-y border-rule ${target?.kind === "anytime" ? "bg-accent-wash" : ""}`}
        >
          <h3 className="w-[var(--lw)] flex-none border-r border-rule px-2 py-3 font-serif text-base leading-tight font-medium rail:px-3">
            Any time
          </h3>
          {score.anyTime.length ? (
            <ul className="flex min-w-0 flex-wrap items-center gap-2.5 p-2.5" aria-label="Any time today">
              {chips(score.anyTime, "any time")}
            </ul>
          ) : (
            <p className="px-3 py-3 text-[13px] text-ink-3">For things that belong to the day but not to an hour.</p>
          )}
        </div>
      )}

      <div className="sticky top-0 z-10 flex h-[34px] border-y border-rule bg-paper" aria-hidden="true">
        <div className="w-[var(--lw)] flex-none border-r border-rule" />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={ticks} className="absolute inset-y-0 left-0" style={{ width }}>
            {hourTicks(axis).map((m) => (
              <span
                key={m}
                data-hour={m / 60}
                className="absolute inset-y-0 border-l border-rule pt-[9px] pl-1.5 text-xs leading-none font-medium text-ink-3 tabular"
                style={{ left: xAt(axis, m) }}
              >
                {formatHour(Math.floor(m / 60), clock)}
              </span>
            ))}
            {nowMinutes !== null && nowMinutes >= axis.start && nowMinutes <= axis.end && (
              <span
                className="absolute top-[5px] z-[1] -translate-x-1/2 rounded bg-accent px-1.5 py-1 text-xs leading-none font-semibold text-on-accent tabular"
                style={{ left: xAt(axis, nowMinutes) }}
              >
                {formatClock(instantAt(date, nowMinutes, timeZone), timeZone, clock)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* With no beam to tab to, the hours take focus themselves, so a keyboard can still scroll them. */}
      <div
        ref={scroller}
        onScroll={syncAxis}
        // Present once the axis has been fitted to the width it was measured at, after hydration.
        data-axis-measured={measured > 0 ? "" : undefined}
        tabIndex={empty ? 0 : undefined}
        role={empty ? "region" : undefined}
        aria-label={empty ? "Hours of the day" : undefined}
        className="overflow-x-auto overflow-y-hidden border-b border-rule"
      >
        <div className="relative" style={{ width: `calc(var(--lw) + ${width}px)` }}>
          {staves.map((staff, i) => (
            <div key={staff.areaId ?? "none"} className="flex border-b border-rule last:border-b-0">
              <div
                data-staff-label
                className="sticky left-0 z-[4] w-[var(--lw)] flex-none border-r border-rule bg-paper px-2 py-3.5 rail:px-3"
              >
                <span className="block font-serif text-base leading-tight font-medium [overflow-wrap:anywhere] rail:text-[19px]">
                  <AreaMark color={staff.color} className="mr-1.5 mb-[0.15em] align-middle" />
                  {staff.name}
                </span>
                {!firstDay && staff.open > 0 && <span className="mt-1 block text-xs text-ink-3 tabular">{staff.open} open</span>}
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
            {examples.map((e) => {
              const staff = staves.find((s) => s.areaId === e.areaId);
              return staff && <Example key={e.areaId} example={e} top={staff.top + beamTop(0)} ctx={ctx} />;
            })}
            {score.ghost && landing && (
              <Ghost top={staves[score.ghost.staff].top + beamTop(score.ghost.row)} placement={landing} ctx={ctx} />
            )}
            {nowMinutes !== null && nowMinutes >= axis.start && nowMinutes <= axis.end && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-[2] -ml-px w-0.5 bg-accent"
                style={{ left: xAt(axis, nowMinutes) }}
              />
            )}
          </div>
        </div>
      </div>

      {firstDay ? (
        <p className="mt-3 text-[13px] text-ink-3">{EXAMPLES_NOTE}</p>
      ) : (
        <>
          <p aria-hidden="true" className="mt-3 hidden text-[13px] leading-relaxed text-ink-3 pointer-coarse:block">
            Press and hold a beam, then drag it to move it, or hold and drag its right end to change its length.
          </p>
          {/* Every beam's description. Seen in the Guide; here only for screen readers. */}
          <p id={KEYS_ID} className="sr-only">
            Drag a beam to move it, or its right end to change its length. With a beam focused, Left and Right move it a
            quarter hour, Shift with Left and Right changes its length, Up and Down change its area, Space marks it done,
            Enter opens it and Backspace sends it back to the Inbox. On an item in the Inbox, Up or Down gives it a time.
          </p>
          <LineLegend now />

          <section
            ref={tray}
            aria-labelledby="tray-h"
            className={`mt-7 pt-2 ${target?.kind === "tray" ? styles.dropZone : ""}`}
          >
            <h3 id="tray-h" className="font-serif text-lg leading-tight font-medium">
              {INBOX}
            </h3>
            <p className="mt-1 mb-3.5 text-[13px] text-ink-3">
              No day yet.{" "}
              <span className="pointer-coarse:hidden">Drag one onto an area to plan it for a time today.</span>
              <span className="hidden pointer-coarse:inline">
                Press and hold one, then drag it onto an area to plan it for a time today.
              </span>{" "}
              Drag a beam back here to clear its day. <SameInInbox />
            </p>
            {score.waiting.length ? (
              <ul className="flex flex-wrap items-center gap-2.5">{chips(score.waiting, "in the Inbox")}</ul>
            ) : (
              <p className="text-[13px] text-ink-3">{EMPTY_TRAY}</p>
            )}
            {waitingFull && <p className="mt-3 text-[13px] text-ink-3">{TRAY_FULL}</p>}
          </section>
        </>
      )}

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
  ctx: BeamContext;
  preview: DragPreview | null;
  count: ChildCount | undefined;
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, kind: "move" | "resize") => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const clock = useClock();
  const { item, state } = beam.value;
  const mine = preview?.item.id === item.id;
  const resizing = mine && preview.kind === "resize" && preview.target?.kind === "resize";
  const span = (resizing && spanOf({ ...item, schedule: preview.target!.placement.schedule }, ctx.date, ctx.timeZone)) || beam.span;
  const startClock = formatClock(minutesToDate(ctx, span.start), ctx.timeZone, clock);
  const endClock = formatClock(minutesToDate(ctx, span.end), ctx.timeZone, clock);
  const p = progress(count);
  // Its time is over and it was never ticked: said in words, quietly, so the day reads left of the playhead.
  const over = state === "planned" && ctx.now !== null && span.end <= ctx.now;
  const event = item.type === "event";
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
      aria-label={`${item.title}, ${event ? "event, " : ""}${startClock} to ${endClock}, ${staff.name}, ${over ? "time passed" : STATE_WORD[state]}${item.dueOn && state !== "done" ? `, ${dueWords(item.dueOn, ctx.today).words}` : ""}${repeats(item) ? ", repeats" : ""}${p ? `, ${p.spoken}` : ""}${spokenTags(tags)}`}
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
        <AreaMark color={staff.color} done={state === "done"} className="mr-1.5 mb-px align-middle" />
        {item.title}
        {repeats(item) && <RepeatMark className={styles.repeat} />}
        {p && <span className={styles.count}>{p.text}</span>}
        <time className={styles.clock} dateTime={minutesToDate(ctx, span.start).toISOString()}>
          {resizing ? `${startClock} to ${endClock}` : event ? `${startClock}–${endClock}` : startClock}
        </time>
        {over && <span className={styles.clock}>passed</span>}
        {item.dueOn && state !== "done" && <DueMark dueOn={item.dueOn} today={ctx.today} className={styles.clock} />}
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
  const clock = useClock();
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
        {formatClock(s.start, ctx.timeZone, clock)} to {formatClock(s.end, ctx.timeZone, clock)}
      </span>
    </div>
  );
}

/** A first-day example: drawn like a planned beam in Hairline, hidden from assistive tech, never a target. EXAMPLES_NOTE says what it is. */
function Example({ example, top, ctx }: { example: ExampleBeam; top: number; ctx: DropContext }) {
  const clock = useClock();
  const { span } = example;
  return (
    <div
      aria-hidden="true"
      data-example
      className={styles.example}
      style={{ left: xAt(ctx.axis, span.start), width: (span.end - span.start) * PX_PER_MINUTE, top }}
    >
      <span className={styles.label}>
        {example.title}
        <span className={styles.clock}>{formatClock(minutesToDate(ctx, span.start), ctx.timeZone, clock)}</span>
      </span>
    </div>
  );
}

function spokenTags(tags: readonly string[] | undefined) {
  const { spoken } = tagLine(tags ?? []);
  return spoken ? `, ${spoken}` : "";
}

/** Done items folded away under one quiet line that opens in place. */
export function DoneFold({
  count,
  children,
  listClassName = "mt-2 flex flex-wrap gap-2.5",
}: {
  count: number;
  children: ReactNode;
  listClassName?: string;
}) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink-2 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Done ({count})
      </summary>
      <ul className={listClassName}>{children}</ul>
    </details>
  );
}

function Chip({
  entry,
  count,
  tags,
  today,
  selected,
  justDone,
  lifted,
  where,
  color,
  onPointerDown,
  onKeyDown,
}: {
  entry: TodayEntry;
  count: ChildCount | undefined;
  tags: readonly string[] | undefined;
  today: LocalDate;
  selected: boolean;
  justDone: boolean;
  lifted: boolean;
  where: string;
  color: AreaColor | null;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const { item, state } = entry;
  const p = progress(count);
  const due = item.dueOn && state !== "done" ? item.dueOn : null;
  return (
    <div
      data-item={item.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}, ${where}, ${STATE_WORD[state]}${due ? `, ${dueWords(due, today).words}` : ""}${repeats(item) ? ", repeats" : ""}${p ? `, ${p.spoken}` : ""}${spokenTags(tags)}`}
      aria-describedby={KEYS_ID}
      className={`${styles.chip} ${selected ? styles.selected : ""} ${state === "done" ? styles.done : ""} ${lifted ? styles.lifted : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <ViewTransition name={`item-${item.id}`} share="morph" default="none">
        <Glyph type={item.type} state={state} justDone={justDone} className={styles.glyph} />
      </ViewTransition>
      <AreaMark color={color} done={state === "done"} />
      <span className="min-w-0 truncate">{item.title}</span>
      {repeats(item) && <RepeatMark className="text-ink-3" />}
      {p && <span className={styles.count}>{p.text}</span>}
      {due && <DueMark dueOn={due} today={today} className="text-xs text-ink-3" />}
      <RowTags tags={tags} max={2} className="whitespace-nowrap" />
    </div>
  );
}
