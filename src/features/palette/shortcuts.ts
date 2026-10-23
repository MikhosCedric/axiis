import { PLACES } from "@/components/shell/places";
import type { KeyPress } from "@/features/day/nav";
import { SNAP_MINUTES } from "@/features/score/snap";

/** A key as `KeyboardEvent#key` names it, with Ctrl (Cmd on a Mac) or Shift held when set. */
export type Chord = { key: string; mod?: true; shift?: true };

/** The code that answers a shortcut. The table's test asks each one whether it really does. */
export type Handler =
  | "global"
  | "dialog"
  | "go"
  | "area"
  | "day-nav"
  | "capture"
  | "score-item"
  | "week-item"
  | "month-grid"
  | "inbox"
  | "undo"
  | "inline-edit"
  | "confirm-delete"
  | "note-editor"
  | "link-picker";

/** `then` makes the shortcut a sequence: press the chord, then this key. */
export type Shortcut = { chords: Chord[]; then?: Chord; does: string; handler: Handler };
export type ShortcutGroup = { where: string; shortcuts: Shortcut[] };

export const PALETTE_KEY = "k";
export const HELP_KEY = "?";
export const GO_KEY = "g";
/** Goes to the page's capture field, or opens the palette to capture where a page has none. */
export const CAPTURE_KEY = "c";
/** How long the key after G is waited for, in milliseconds. */
export const GO_WINDOW_MS = 1500;

export const AREA_KEY = "a";
/** How many areas the A keys reach, one per digit. */
export const AREA_KEYS_MAX = 9;

/** Where G followed by a key goes. */
export const GO_PLACES = PLACES.flatMap((p) => (p.go ? [{ key: p.go, label: p.label, href: p.href }] : []));

const k = (key: string, extra: Omit<Chord, "key"> = {}): Chord => ({ key, ...extra });

export const SHORTCUTS: ShortcutGroup[] = [
  {
    where: "Anywhere",
    shortcuts: [
      { chords: [k(PALETTE_KEY, { mod: true })], does: "Search, jump to a page or date, or capture", handler: "global" },
      { chords: [k(HELP_KEY)], does: "Open the Guide: this page, then every shortcut", handler: "global" },
      { chords: [k("Escape")], does: "Close search or this list", handler: "dialog" },
      { chords: [k(CAPTURE_KEY)], does: "Capture: the page's capture field, or search where a page has none", handler: "capture" },
      { chords: [k("z", { mod: true })], does: "Undo the change just made, while its note shows", handler: "undo" },
    ],
  },
  {
    where: "Go to a page",
    shortcuts: GO_PLACES.map((p) => ({ chords: [k(GO_KEY)], then: k(p.key), does: `Go to ${p.label}`, handler: "go" as const })),
  },
  {
    where: "Show one area",
    shortcuts: [
      { chords: [k(AREA_KEY)], then: k("1"), does: `Show only the first area, through ${AREA_KEYS_MAX} for the ninth, in the rail's order`, handler: "area" },
      { chords: [k(AREA_KEY)], then: k("0"), does: "Show all areas again", handler: "area" },
    ],
  },
  {
    where: "Today, Week and Month",
    shortcuts: [
      { chords: [k("[")], does: "Previous day, week or month", handler: "day-nav" },
      { chords: [k("]")], does: "Next day, week or month", handler: "day-nav" },
      { chords: [k("t")], does: "Back to today, this week or this month", handler: "day-nav" },
      { chords: [k("Escape")], does: "Leave the capture field", handler: "capture" },
    ],
  },
  {
    where: "The Inbox",
    shortcuts: [
      { chords: [k("j"), k("ArrowDown")], does: "The next item", handler: "inbox" },
      { chords: [k("k"), k("ArrowUp")], does: "The item before", handler: "inbox" },
      { chords: [k("1")], does: "Plan it for today", handler: "inbox" },
      { chords: [k("2")], does: "Plan it for tomorrow", handler: "inbox" },
      { chords: [k("3")], does: "Plan it for next week", handler: "inbox" },
      { chords: [k("4")], does: "Plan it for another day", handler: "inbox" },
    ],
  },
  {
    where: "A task on the Score",
    shortcuts: [
      { chords: [k("Enter")], does: "Open its details", handler: "score-item" },
      { chords: [k(" ")], does: "Mark done or not done", handler: "score-item" },
      { chords: [k("Escape")], does: "Close the details", handler: "score-item" },
      { chords: [k("ArrowLeft"), k("ArrowRight")], does: `Move it ${SNAP_MINUTES} minutes earlier or later`, handler: "score-item" },
      {
        chords: [k("ArrowLeft", { shift: true }), k("ArrowRight", { shift: true })],
        does: `Make it ${SNAP_MINUTES} minutes shorter or longer`,
        handler: "score-item",
      },
      { chords: [k("ArrowUp"), k("ArrowDown")], does: "Move it to the area above or below, or give an Inbox item a time", handler: "score-item" },
      { chords: [k("Backspace"), k("Delete")], does: "Take its time away, back to the Inbox", handler: "score-item" },
    ],
  },
  {
    where: "A task on the Week",
    shortcuts: [
      { chords: [k("Enter")], does: "Open its details", handler: "week-item" },
      { chords: [k(" ")], does: "Mark done or not done", handler: "week-item" },
      { chords: [k("Escape")], does: "Close the details", handler: "week-item" },
      { chords: [k("ArrowLeft"), k("ArrowRight")], does: "Move it a day earlier or later", handler: "week-item" },
      { chords: [k("ArrowUp")], does: "Give an Inbox item a day", handler: "week-item" },
      { chords: [k("Backspace"), k("Delete")], does: "Send it back to the Inbox", handler: "week-item" },
    ],
  },
  {
    where: "A day on the Month",
    shortcuts: [
      { chords: [k("ArrowLeft"), k("ArrowRight")], does: "The day before or after", handler: "month-grid" },
      { chords: [k("ArrowUp"), k("ArrowDown")], does: "The same day a week earlier or later", handler: "month-grid" },
      { chords: [k("Home"), k("End")], does: "The first or last day of that week", handler: "month-grid" },
      { chords: [k("PageUp"), k("PageDown")], does: "The same day a month earlier or later", handler: "month-grid" },
      { chords: [k("Enter")], does: "Open the day", handler: "month-grid" },
    ],
  },
  {
    where: "Writing a note",
    shortcuts: [
      { chords: [k("b", { mod: true })], does: "Bold", handler: "note-editor" },
      { chords: [k("i", { mod: true })], does: "Italic", handler: "note-editor" },
      { chords: [k(PALETTE_KEY, { mod: true })], does: "Add or change a link, instead of search", handler: "note-editor" },
      { chords: [k("Escape")], does: "Leave the link field and go back to writing", handler: "note-editor" },
      { chords: [k("ArrowUp"), k("ArrowDown")], does: "Choose an item to connect", handler: "link-picker" },
      { chords: [k("Enter")], does: "Connect the chosen item", handler: "link-picker" },
      { chords: [k("Escape")], does: "Close the list of items to connect", handler: "link-picker" },
    ],
  },
  {
    where: "Editing a title or area name",
    shortcuts: [
      { chords: [k("Enter")], does: "Save", handler: "inline-edit" },
      { chords: [k("Escape")], does: "Put the saved text back", handler: "inline-edit" },
      { chords: [k("Escape")], does: "Keep the item when asked to delete it", handler: "confirm-delete" },
    ],
  },
];

export type GlobalAction = "palette" | "help";

export type GoStep = "wait" | { href: string } | null;

/**
 * The "go to" sequence: G, then a place's key. `waiting` says G was just pressed.
 * Returns "wait" for that G, the page for the key that follows it, and null for
 * anything else, which also ends the wait. Never acts while typing or with a modifier held.
 */
export function goShortcut(waiting: boolean, e: KeyPress): GoStep {
  if (e.isComposing || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.typing) return null;
  const key = e.key.toLowerCase();
  if (!waiting) return key === GO_KEY ? "wait" : null;
  const place = GO_PLACES.find((p) => p.key === key);
  return place ? { href: place.href } : null;
}

export type AreaStep = "wait" | { index: number | null } | null;

/**
 * The area sequence: A, then a digit. 1 to 9 pick that area in the rail's order
 * (`count` areas exist), 0 shows every area again. Like G, never while typing or
 * with a modifier held, and any other key ends the wait.
 */
export function areaShortcut(waiting: boolean, e: KeyPress, count: number): AreaStep {
  if (e.isComposing || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.typing) return null;
  if (!waiting) return e.key.toLowerCase() === AREA_KEY && count > 0 ? "wait" : null;
  if (e.key === "0") return { index: null };
  const n = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
  return n >= 1 && n <= Math.min(count, AREA_KEYS_MAX) ? { index: n - 1 } : null;
}

/**
 * What a key press anywhere in the app asks for. Ctrl or Cmd with K works even
 * while typing, unless something closer already took it (the note editor's
 * link). The question mark only counts when no text field has focus.
 */
export function globalShortcut(e: KeyPress): GlobalAction | null {
  if (e.isComposing || e.defaultPrevented || e.altKey) return null;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === PALETTE_KEY) return "palette";
  if (e.key === HELP_KEY && !e.ctrlKey && !e.metaKey && !e.typing) return "help";
  return null;
}

const NAMES: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Backspace: "Backspace",
  Delete: "Delete",
  Enter: "Enter",
  Home: "Home",
  End: "End",
  PageUp: "Page Up",
  PageDown: "Page Down",
};

const SPOKEN: Record<string, string> = {
  ArrowLeft: "Left arrow",
  ArrowRight: "Right arrow",
  ArrowUp: "Up arrow",
  ArrowDown: "Down arrow",
  Escape: "Escape",
  "?": "Question mark",
  "[": "Left bracket",
  "]": "Right bracket",
};

/** The caps to draw for a chord, as on the keyboard: ["Ctrl", "K"] or ["⌘", "K"]. */
export function chordCaps(chord: Chord, mac: boolean): string[] {
  const key = NAMES[chord.key] ?? chord.key.toUpperCase();
  return [...(chord.mod ? [mac ? "⌘" : "Ctrl"] : []), ...(chord.shift ? ["Shift"] : []), key];
}

/** The chord as words, for a screen reader: "Control K", "Shift Left arrow". */
export function chordSpoken(chord: Chord, mac: boolean, then?: Chord): string {
  const key = SPOKEN[chord.key] ?? NAMES[chord.key] ?? chord.key.toUpperCase();
  const spoken = [...(chord.mod ? [mac ? "Command" : "Control"] : []), ...(chord.shift ? ["Shift"] : []), key].join(" ");
  return then ? `${spoken} then ${chordSpoken(then, mac)}` : spoken;
}
