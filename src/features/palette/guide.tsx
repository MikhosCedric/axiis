"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, type ReactNode } from "react";
import { AreaMark } from "@/components/area-mark";
import { TOUR_COOKIE } from "@/components/shell/cookies";
import type { ItemType } from "@/domain/item";
import { Glyph } from "@/features/today/glyph";
import type { BeamState } from "@/features/today/model";
import styles from "./palette.module.css";
import { chordCaps, chordSpoken, HELP_KEY, SHORTCUTS, type Chord } from "./shortcuts";
import { useIsMac } from "./use-is-mac";

/** A part of the Guide that explains one screen's own words and gestures. */
export type GuideTopic = "capture" | "score" | "week" | "month";

type GuideControls = {
  open: () => void;
  /** Puts these topics at the head of the Guide while the screen that shows them is up. Returns the undo. */
  show: (topics: readonly GuideTopic[]) => () => void;
};

export const GuideContext = createContext<GuideControls>({ open: () => {}, show: () => () => {} });

/**
 * The one way into the Guide on a screen, at the end of its tool row. It also
 * tells the Guide which topics this screen has, so ? opens on the same ones.
 */
export function GuideButton({ topics, className = "" }: { topics: readonly GuideTopic[]; className?: string }) {
  const { open, show } = useContext(GuideContext);
  const key = topics.join(" ");
  useEffect(() => show(key.split(" ") as GuideTopic[]), [show, key]);
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      aria-keyshortcuts={HELP_KEY}
      title="Guide ( ? )"
      className={`inline-flex flex-none items-center gap-1.5 rounded-lg border border-rule px-3 py-2 font-medium text-ink-2 hover:bg-hover hover:text-ink active:bg-press pointer-coarse:py-3 ${className}`}
    >
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
        <circle cx="8" cy="8" r="6.4" />
        <path d="M6.3 6.4a1.75 1.75 0 1 1 2.4 1.62c-.42.18-.7.55-.7 1v.38" />
        <circle cx="8" cy="11.35" r=".2" fill="currentColor" strokeWidth={1.2} />
      </svg>
      Guide
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-2">{children}</kbd>;
}

function ChordKeys({ chord, mac }: { chord: Chord; mac: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {chordCaps(chord, mac).map((cap) => (
        <Kbd key={cap}>{cap}</Kbd>
      ))}
    </span>
  );
}

function Topic({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-b border-rule-soft py-5 first:pt-4">
      <h3 id={id} className="font-serif text-[17px] leading-tight font-medium">
        {title}
      </h3>
      <div className="mt-2 space-y-2 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const CAPTURE_WORDS: [string, string][] = [
  ["Days", "today, tomorrow, a weekday, on friday, by friday, next friday, in 3 days, 2026-12-24"],
  ["Times", "9:00, 14:30, 9am, 2:30pm, at 9, or 9 and 0930 right after a day"],
  ["Length", "after a time, for 45m or for 1h 30m; otherwise 30 minutes"],
  [
    "Kept as typed",
    "everything else, a day after a word like for or until (“groceries for sunday”), a word after a backslash (\\friday), and a whole line in quotes",
  ],
];

function CaptureTopic({ id }: { id: string }) {
  return (
    <Topic id={id} title="Capture words">
      <p>
        Put a day, a time or tags at the start or end of a capture, as in{" "}
        <span className="rounded border border-rule bg-paper px-1.5 py-px whitespace-nowrap text-ink">dentist tomorrow 9:00 #health</span>.
      </p>
      <dl className="grid gap-x-4 gap-y-1.5 pt-1 min-[480px]:grid-cols-[7.5rem_minmax(0,1fr)]">
        {CAPTURE_WORDS.map(([term, words]) => (
          <div key={term} className="contents">
            <dt className="text-[13px] font-medium text-ink">{term}</dt>
            <dd className="mb-1.5 text-[13px] min-[480px]:mb-0">{words}</dd>
          </div>
        ))}
      </dl>
    </Topic>
  );
}

function ScoreTopic({ id }: { id: string }) {
  return (
    <Topic id={id} title="Moving beams">
      <p>
        Drag a beam along its staff to move it, or its right end to change its length. Drag it down to the Inbox to clear
        its day, or one from the Inbox up onto an area to give it a time.
      </p>
      <p>On a touch screen, press and hold first, then drag. With a beam focused, the arrow keys do the same; see below.</p>
    </Topic>
  );
}

function WeekTopic({ id }: { id: string }) {
  return (
    <Topic id={id} title="Moving between days">
      <p>
        Drag an item to another day, or down to the Inbox to clear its day. With an item focused, the arrow keys do the
        same; see below.
      </p>
    </Topic>
  );
}

function MonthTopic({ id }: { id: string }) {
  return (
    <Topic id={id} title="The month">
      <p>
        Click a day, or press Enter on it, to open it. The arrow keys move between days, Page Up and Page Down change
        the month. Drag an item to another day to move it there. What you capture lands on the day in focus unless you
        name another. Jump to month goes to any month, as does typing one in the palette, such as “nov 2026”.
      </p>
    </Topic>
  );
}

const KINDS: { type: ItemType; term: string; says: string }[] = [
  { type: "task", term: "Task", says: "Something to do. A round head; it can move." },
  { type: "event", term: "Event", says: "Something at a fixed time. Ticks at both ends; it says its whole time." },
  { type: "checklist", term: "Checklist", says: "A list of small lines. A square head." },
];

const STATES: { state: BeamState; term: string; says: string }[] = [
  { state: "planned", term: "Planned", says: "Dashed: still to come, or with no time yet." },
  { state: "live", term: "Happening", says: "Solid green: its time is now." },
  { state: "done", term: "Done", says: "Hollow. Done items fold into one Done line." },
];

const WORDS: [string, string][] = [
  ["Inbox", "What you captured with no day yet. Nothing there is late."],
  ["Any time", "On a day, at no particular hour."],
  ["Passed", "Its time is over and it was never ticked."],
  ["Due", "A deadline, apart from when you planned it. The flag fills once the day has come."],
  ["Left over", "Planned for an earlier day and still open, shown below Today's plan."],
];

/** What every shape, line and word means, on every screen, and the way back into the tour. */
function KeyTopic({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  function replay() {
    document.cookie = `${TOUR_COOKIE}=replay; path=/; max-age=31536000; samesite=lax`;
    onClose();
    router.push("/today");
    router.refresh();
  }
  const row = "flex items-start gap-3 text-[13px]";
  return (
    <Topic id={id} title="What you see">
      <ul aria-label="Kinds of item" className="space-y-1.5 pt-1">
        {KINDS.map((k) => (
          <li key={k.type} className={row}>
            <Glyph type={k.type} state="planned" className="mt-0.5 !w-9" />
            <span>
              <span className="font-medium text-ink">{k.term}.</span> {k.says}
            </span>
          </li>
        ))}
      </ul>
      <ul aria-label="Line forms" className="space-y-1.5 pt-2">
        {STATES.map((s) => (
          <li key={s.state} className={row}>
            <Glyph type="task" state={s.state} className="mt-0.5 !w-9" />
            <span>
              <span className="font-medium text-ink">{s.term}.</span> {s.says}
            </span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-x-4 gap-y-1.5 pt-2 min-[480px]:grid-cols-[7.5rem_minmax(0,1fr)]">
        {WORDS.map(([term, says]) => (
          <div key={term} className="contents">
            <dt className="text-[13px] font-medium text-ink">{term}</dt>
            <dd className="mb-1.5 text-[13px] min-[480px]:mb-0">{says}</dd>
          </div>
        ))}
      </dl>
      <h4 className="pt-3 text-xs font-semibold text-ink-3">What the colours mean</h4>
      <ul aria-label="What the colours mean" className="space-y-1.5 pt-1.5">
        <li className={row}>
          <span className="mt-1 grid w-9 flex-none justify-items-center">
            <AreaMark color="slate" size={10} />
          </span>
          <span>
            <span className="font-medium text-ink">A dot.</span> The area or tag it belongs to, in the colour you gave it in
            Settings. Choose an area in the sidebar, or press A then its number, to see only that area.
          </span>
        </li>
        <li className={row}>
          <span className="mt-1 grid w-9 flex-none justify-items-center">
            <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-dashed border-ink-3" />
          </span>
          <span>
            <span className="font-medium text-ink">None.</span> No colour is set, so no dot is drawn. Nothing is wrong or missing.
          </span>
        </li>
      </ul>
      <p className="pt-1 text-[13px]">The green of now and of focus is never an area&rsquo;s colour, and no colour means late or done.</p>
      <p className="pt-1">
        <button
          type="button"
          onClick={replay}
          className="rounded-lg border border-rule px-3 py-1.5 font-medium text-ink-2 hover:bg-hover hover:text-ink active:bg-press pointer-coarse:min-h-11"
        >
          Take the tour again
        </button>
      </p>
    </Topic>
  );
}

/** In the order the Guide shows them. */
const TOPICS: Record<GuideTopic, (props: { id: string }) => ReactNode> = {
  capture: CaptureTopic,
  score: ScoreTopic,
  week: WeekTopic,
  month: MonthTopic,
};

/** What the Guide shows: the screen's own topics first, then every keyboard shortcut. */
export function GuideBody({ topics, onClose }: { topics: readonly GuideTopic[]; onClose: () => void }) {
  const mac = useIsMac();
  const id = useId();
  const shown = (Object.keys(TOPICS) as GuideTopic[]).filter((t) => topics.includes(t));
  return (
    <>
      <div className="flex items-center gap-3 border-b border-rule-soft px-5 py-3.5">
        <h2 id={`${id}-h`} className="font-serif text-xl leading-tight font-medium">
          Guide
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="ml-auto rounded-md px-2.5 py-1.5 font-medium text-ink-2 hover:bg-hover hover:text-ink active:bg-press pointer-coarse:min-h-11"
        >
          Close
        </button>
      </div>
      <div className={`${styles.scroll} px-5 pb-5`}>
        {shown.map((t) => {
          const Body = TOPICS[t];
          return <Body key={t} id={`${id}-${t}`} />;
        })}
        <KeyTopic id={`${id}-key`} onClose={onClose} />
        <section aria-labelledby={`${id}-keys`} className="pt-5 first:pt-4">
          <h3 id={`${id}-keys`} className="font-serif text-[17px] leading-tight font-medium">
            Keyboard shortcuts
          </h3>
          {SHORTCUTS.map((group) => (
            <section key={group.where} aria-labelledby={`${id}-${group.where}`} className="mt-4">
              <h4 id={`${id}-${group.where}`} className="mb-1.5 text-xs font-semibold text-ink-3">
                {group.where}
              </h4>
              <dl className="grid grid-cols-1 gap-x-4 min-[480px]:grid-cols-[11.5rem_minmax(0,1fr)] min-[480px]:gap-y-2">
                {group.shortcuts.map((s) => (
                  <div key={`${s.handler}-${s.does}`} className="contents">
                    <dt className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 min-[480px]:mb-0">
                      <span className="sr-only">{s.chords.map((c) => chordSpoken(c, mac, s.then)).join(" or ")}</span>
                      {s.chords.map((chord, i) => (
                        <span key={i} aria-hidden="true" className="inline-flex items-center gap-1.5">
                          {i > 0 && <span className="text-ink-3">or</span>}
                          <ChordKeys chord={chord} mac={mac} />
                          {s.then && (
                            <>
                              <span className="text-ink-3">then</span>
                              <ChordKeys chord={s.then} mac={mac} />
                            </>
                          )}
                        </span>
                      ))}
                    </dt>
                    <dd className="mb-2.5 text-ink-2 min-[480px]:mb-0">{s.does}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </section>
      </div>
    </>
  );
}
