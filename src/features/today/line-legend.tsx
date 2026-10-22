import type { ItemType } from "@/domain/item";
import type { BeamState } from "./model";
import { Glyph } from "./glyph";

const STATES: { state: BeamState; word: string }[] = [
  { state: "planned", word: "Planned" },
  { state: "live", word: "Happening" },
  { state: "done", word: "Done" },
];

/** The shapes, so a newcomer learns them from the page: a head for a task, end ticks for an event, a square for a checklist. */
const KINDS: { type: ItemType; word: string }[] = [
  { type: "task", word: "Task" },
  { type: "event", word: "Event" },
  { type: "checklist", word: "Checklist" },
];

/** The printed key under a score: what each line form means, the now line where there is one, and each kind's shape. */
export function LineLegend({ now }: { now: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-ink-3">
      <ul aria-label="Key" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STATES.map(({ state, word }) => (
          <li key={state} className="flex items-center gap-1.5">
            <Glyph type="task" state={state} className="!w-8" />
            {word}
          </li>
        ))}
        {now && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-4 w-0.5 bg-accent" />
            Now
          </li>
        )}
      </ul>
      <ul aria-label="Kinds" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {KINDS.map(({ type, word }) => (
          <li key={type} className="flex items-center gap-1.5">
            <Glyph type={type} state="planned" className="!w-8" />
            {word}
          </li>
        ))}
      </ul>
    </div>
  );
}
