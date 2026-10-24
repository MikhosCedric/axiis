import type { LocalDate } from "@/domain/item";
import type { MonthMark } from "@/features/month/model";
import { tagLine } from "@/features/tags/model";
import { formatClock, type Clock } from "@/lib/clock";
import type { ChildCount } from "@/lib/items/repo";
import { dueWords } from "./due";
import type { BeamState } from "./model";

export const STATE_WORD: Record<BeamState, string> = { planned: "planned", live: "happening now", done: "done" };

type Words = string | false | null | undefined;

/**
 * An item's accessible name (WCAG 2.5.3, Label in Name): the words drawn on it, in the order drawn, then what the
 * drawing says without words. A voice-control user who says what they see reaches the item.
 */
function itemName(shown: readonly Words[], said: readonly Words[]): string {
  return [...shown, ...said].filter(Boolean).join(", ");
}

function progress(count: ChildCount | undefined) {
  return count ? { text: `${count.done}/${count.total}`, spoken: `${count.done} of ${count.total} subtasks done` } : null;
}

const tagged = (tags: readonly string[], max: number) => {
  const line = tagLine(tags, max);
  return { shown: line.shown || null, spoken: line.spoken };
};

/** The tags a chip draws (row-tags.tsx shows as many). */
export const CHIP_TAGS = 2;

type Common = {
  title: string;
  state: BeamState;
  repeats: boolean;
  /** Only while the item is open: a done item shows no due mark. */
  dueOn: LocalDate | null;
  today: LocalDate;
  tags: readonly string[];
};

/** A timed item on the Score: "Write the brief 2/5 10:00 AM passed Due today". */
export function beamWords(b: Common & {
  event: boolean;
  start: Date;
  end: Date;
  timeZone: string;
  clock: Clock;
  /** Being resized, so both ends show. */
  resizing: boolean;
  /** Its time is over and it was never ticked. */
  over: boolean;
  area: string;
  count: ChildCount | undefined;
}) {
  const start = formatClock(b.start, b.timeZone, b.clock);
  const end = formatClock(b.end, b.timeZone, b.clock);
  const time = b.resizing ? `${start} to ${end}` : b.event ? `${start}–${end}` : start;
  const count = progress(b.count);
  const due = b.dueOn && dueWords(b.dueOn, b.today).words;
  const name = itemName(
    [b.title, count?.text, time, b.over && "passed", due],
    [b.event && "event", !b.event && !b.resizing && `ends ${end}`, b.area, !b.over && STATE_WORD[b.state], b.repeats && "repeats", count?.spoken, tagged(b.tags, 0).spoken],
  );
  return { time, count: count?.text ?? null, name };
}

/** An item without a time on the Score: "Pay the bill 1/3 Due today #bills". `where` says the line it sits on. */
export function chipWords(c: Common & { where: string; count: ChildCount | undefined }) {
  const count = progress(c.count);
  const due = c.dueOn && dueWords(c.dueOn, c.today).words;
  const tags = tagged(c.tags, CHIP_TAGS);
  return {
    count: count?.text ?? null,
    name: itemName([c.title, count?.text, due, tags.shown], [c.where, STATE_WORD[c.state], c.repeats && "repeats", count?.spoken, tags.spoken]),
  };
}

type Schedule = { kind: "unscheduled" } | { kind: "day" } | { kind: "timed"; start: Date; end: Date };

/** An item in a Week day: a row ("Stand-up 9:30 AM–9:45 AM Due today Work #team") or, on a phone's Any time line, a chip with only its title. */
export function weekWords(w: Common & {
  variant: "row" | "chip";
  event: boolean;
  schedule: Schedule;
  timeZone: string;
  clock: Clock;
  area: string | null;
}) {
  const s = w.schedule;
  const at = s.kind === "timed" ? { start: formatClock(s.start, w.timeZone, w.clock), end: formatClock(s.end, w.timeZone, w.clock) } : null;
  // An event holds its whole time, so it says where it ends too; a task says when it starts.
  const time = at ? (w.event ? `${at.start}–${at.end}` : at.start) : s.kind === "day" ? "Any time" : null;
  const due = w.dueOn && dueWords(w.dueOn, w.today).words;
  const tags = tagged(w.tags, CHIP_TAGS);
  const shown = w.variant === "row" ? [w.title, time, due, w.area, tags.shown] : [w.title];
  const when = w.variant === "row" ? (at && !w.event ? `ends ${at.end}` : !time && "in the Inbox") : at ? `${at.start} to ${at.end}` : (time ?? "in the Inbox");
  const name = itemName(shown, [when, w.variant === "chip" && w.area, STATE_WORD[w.state], w.variant === "chip" && due, w.repeats && "repeats", tags.spoken]);
  return { time, due, tags: tags.shown, name };
}

/** An item on a Month day: "9:30 AM Standup", "Due File the report"; a row on a phone also shows its area. */
export function monthMarkName(mark: MonthMark, variant: "cell" | "row"): string {
  const shown = [mark.time, mark.due && (mark.time ? "due" : "Due"), mark.title, variant === "row" && mark.area];
  const when = mark.time === null ? !mark.due && "any time" : mark.time.startsWith("to ") && "continues from the day before";
  return itemName(shown, [when, variant === "cell" && mark.area, STATE_WORD[mark.state], mark.repeats && "repeats"]);
}
