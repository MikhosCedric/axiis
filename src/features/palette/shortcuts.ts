import type { KeyPress } from "@/features/day/nav";
import { DUE_PATH } from "@/features/due/model";
import { LISTS_PATH } from "@/features/lists/model";
import { SNAP_MINUTES } from "@/features/score/snap";

/** A key as `KeyboardEvent#key` names it, with Ctrl (Cmd on a Mac) or Shift held when set. */
export type Chord = { key: string; mod?: true; shift?: true };

/** The code that answers a shortcut. The table's test asks each one whether it really does. */
export type Handler =
  | "global"
  | "dialog"
  | "go"
  | "day-nav"
  | "capture"
  | "score-item"
  | "week-item"
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
/** How long the key after G is waited for, in milliseconds. */
export const GO_WINDOW_MS = 1500;

/** Where G followed by a key goes. */
export const GO_PLACES = [
  { key: "t", label: "Today", href: "/today" },
  { key: "w", label: "Week", href: "/week" },
  { key: "i", label: "Inbox", href: "/inbox" },
  { key: "d", label: "Due", href: DUE_PATH },
  { key: "l", label: "Lists", href: LISTS_PATH },
  { key: "n", label: "Notes", href: "/notes" },
  { key: "s", label: "Search", href: "/search" },
  { key: ",", label: "Settings", href: "/settings" },
] as const;

const k = (key: string, extra: Omit<Chord, "key"> = {}): Chord => ({ key, ...extra });

export const SHORTCUTS: ShortcutGroup[] = [
  {
    where: "Anywhere",
    shortcuts: [
      { chords: [k(PALETTE_KEY, { mod: true })], does: "Search, jump to a page or date, or capture", handler: "global" },
      { chords: [k(HELP_KEY)], does: "Show these shortcuts", handler: "global" },
      { chords: [k("Escape")], does: "Close search or this list", handler: "dialog" },
    ],
  },
  {
    where: "Go to a page",
    shortcuts: GO_PLACES.map((p) => ({ chords: [k(GO_KEY)], then: k(p.key), does: `Go to ${p.label}`, handler: "go" as const })),
  },
  {
    where: "Today and Week",
    shortcuts: [
      { chords: [k("[")], does: "Previous day or week", handler: "day-nav" },
      { chords: [k("]")], does: "Next day or week", handler: "day-nav" },
      { chords: [k("t")], does: "Back to today or this week", handler: "day-nav" },
      { chords: [k("c")], does: "Go to the capture field", handler: "capture" },
      { chords: [k("Escape")], does: "Leave the capture field", handler: "capture" },
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
      { chords: [k("ArrowUp"), k("ArrowDown")], does: "Move it to the area above or below, or give a waiting task a time", handler: "score-item" },
      { chords: [k("Backspace"), k("Delete")], does: "Take its time away, back to waiting", handler: "score-item" },
    ],
  },
  {
    where: "A task on the Week",
    shortcuts: [
      { chords: [k("Enter")], does: "Open its details", handler: "week-item" },
      { chords: [k(" ")], does: "Mark done or not done", handler: "week-item" },
      { chords: [k("Escape")], does: "Close the details", handler: "week-item" },
      { chords: [k("ArrowLeft"), k("ArrowRight")], does: "Move it a day earlier or later", handler: "week-item" },
      { chords: [k("ArrowUp")], does: "Give a waiting task a day", handler: "week-item" },
      { chords: [k("Backspace"), k("Delete")], does: "Send it back to waiting", handler: "week-item" },
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
