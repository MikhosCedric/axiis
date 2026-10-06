import type { BeamState } from "./model";
import { Glyph } from "./glyph";

const STATES: { state: BeamState; word: string }[] = [
  { state: "planned", word: "Planned" },
  { state: "live", word: "Happening" },
  { state: "done", word: "Done" },
];

/** The printed key under a score: what each line form means, and the now line where there is one. */
export function LineLegend({ now }: { now: boolean }) {
  return (
    <ul aria-label="Key" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
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
  );
}
