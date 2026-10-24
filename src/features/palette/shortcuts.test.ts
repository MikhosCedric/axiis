import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AreaId, LocalDate } from "@/domain/item";
import { shortcutAction, type KeyPress } from "@/features/day/nav";
import { keyPlacement, type DropContext } from "@/features/score/drop";
import { makeItem } from "@/features/today/test-support";
import { gridStep } from "@/features/month/grid-step";
import { rowKey } from "@/features/inbox/model";
import { keyDestination, weekOf } from "@/features/week/model";
import { instantAt } from "@/lib/dates";
import { areaShortcut, chordCaps, chordSpoken, globalShortcut, goShortcut, GO_PLACES, SHORTCUTS, type Chord, type Handler } from "./shortcuts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Whether a component's own key handler names this key. */
const names = (path: string, key: string) =>
  [`e.key === "${key}"`, `e.key !== "${key}"`, `event.key.toLowerCase() === "${key}"`].some((s) => source(path).includes(s));

const press = (chord: Chord, over: Partial<KeyPress> = {}): KeyPress => ({
  key: chord.key,
  altKey: false,
  ctrlKey: !!chord.mod,
  metaKey: false,
  isComposing: false,
  defaultPrevented: false,
  typing: false,
  ...over,
});

const date = "2026-10-06" as LocalDate;
const ctx: DropContext = { date, timeZone: "UTC", axis: { start: 420, end: 1200 }, now: null };
const work = "00000000-0000-4000-9000-000000000001" as AreaId;
const beam = makeItem({ schedule: { kind: "timed", start: instantAt(date, 600, "UTC"), end: instantAt(date, 630, "UTC") } });
const waiting = makeItem();
const days = weekOf(date);
const planned = makeItem({ schedule: { kind: "day", on: "2026-10-07" as LocalDate } });

/** Asks the code behind each handler whether it answers the chord. Every handler must have one. */
const answers: Record<Handler, (chord: Chord) => boolean> = {
  global: (c) => globalShortcut(press(c)) !== null,
  go: (c) => goShortcut(false, press(c)) === "wait" && GO_PLACES.every((p) => goShortcut(true, press({ key: p.key })) !== null),
  area: (c) => areaShortcut(false, press(c), 3) === "wait" && source("palette/palette.tsx").includes("areaShortcut("),
  dialog: (c) => c.key === "Escape" && source("palette/palette.tsx").includes(".showModal()"),
  "day-nav": (c) =>
    shortcutAction(press(c)) !== null &&
    shortcutAction(press({ key: c.key.toUpperCase() })) !== null &&
    source("day/day-nav.tsx").includes("shortcutAction(") &&
    source("week/week-nav.tsx").includes("shortcutAction(") &&
    source("month/month-nav.tsx").includes("shortcutAction("),
  capture: (c) => names("today/capture-field.tsx", c.key) && source("palette/palette.tsx").includes("e.key === CAPTURE_KEY"),
  "score-item": (c) =>
    names("score/score-view.tsx", c.key) ||
    [beam, waiting].some((item) => keyPlacement(ctx, item, [null, work], { key: c.key, shiftKey: !!c.shift }) !== null),
  "week-item": (c) =>
    names("week/week-view.tsx", c.key) || [planned, waiting].some((item) => keyDestination(item, days, date, "UTC", c.key) !== null),
  "month-grid": (c) => gridStep(c.key, 3) !== null || names("month/month-view.tsx", c.key),
  inbox: (c) => rowKey(c.key, date) !== null && source("inbox/inbox-view.tsx").includes("rowKey(e.key"),
  undo: (c) => !!c.mod && source("../components/undo-toast.tsx").includes(`e.key.toLowerCase() !== "${c.key}"`),
  "inline-edit": (c) => names("detail/inline-title.tsx", c.key) && names("account/areas-section.tsx", c.key),
  "confirm-delete": (c) => names("detail/confirm-delete.tsx", c.key),
  "note-editor": (c) =>
    names("notes/rich-text.tsx", c.key) || (!!c.mod && source("notes/rich-text.tsx").includes(`keys="Control+${c.key.toUpperCase()}"`)),
  "link-picker": (c) => names("notes/connected.tsx", c.key),
};

describe("the shortcuts table", () => {
  const rows = SHORTCUTS.flatMap((g) => g.shortcuts.flatMap((s) => s.chords.map((chord) => ({ where: g.where, does: s.does, handler: s.handler, chord, then: s.then }))));

  it.each(rows)("$where: $does ($chord.key) is answered by $handler", ({ handler, chord }) => {
    expect(answers[handler](chord)).toBe(true);
  });

  it("does not list a key twice for the same thing in one place", () => {
    const seen = rows.map((r) => `${r.where}|${r.handler}|${r.chord.key}|${!!r.chord.mod}|${!!r.chord.shift}|${r.then?.key ?? ""}`);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("areaShortcut", () => {
  const step = (waiting: boolean, key: string, count = 3, over: Partial<KeyPress> = {}) => areaShortcut(waiting, press({ key }, over), count);

  it("waits after A, then picks an area by its digit or every area with 0", () => {
    expect(step(false, "a")).toBe("wait");
    expect(step(false, "A")).toBe("wait");
    expect(step(true, "1")).toEqual({ index: 0 });
    expect(step(true, "3")).toEqual({ index: 2 });
    expect(step(true, "0")).toEqual({ index: null });
  });

  it("ignores a digit past the areas there are, any other key, typing, modifiers, and A with no areas", () => {
    expect(step(true, "4")).toBeNull();
    expect(step(true, "x")).toBeNull();
    expect(step(true, "1", 12)).toEqual({ index: 0 });
    expect(step(false, "1")).toBeNull();
    expect(step(false, "a", 3, { typing: true })).toBeNull();
    expect(step(false, "a", 3, { ctrlKey: true })).toBeNull();
    expect(step(false, "a", 0)).toBeNull();
  });
});

describe("globalShortcut", () => {
  const key = (k: string, over: Partial<KeyPress> = {}) => globalShortcut(press({ key: k }, over));

  it("opens search with Ctrl or Cmd and K, even while typing", () => {
    expect(key("k", { ctrlKey: true })).toBe("palette");
    expect(key("K", { metaKey: true, typing: true })).toBe("palette");
    expect(key("k")).toBeNull();
  });

  it("leaves Ctrl K alone when something closer took it", () => {
    expect(key("k", { ctrlKey: true, defaultPrevented: true })).toBeNull();
    expect(key("k", { ctrlKey: true, altKey: true })).toBeNull();
    expect(key("k", { ctrlKey: true, isComposing: true })).toBeNull();
  });

  it("shows the shortcuts on a question mark only when nothing is being typed", () => {
    expect(key("?")).toBe("help");
    expect(key("?", { typing: true })).toBeNull();
    expect(key("?", { ctrlKey: true })).toBeNull();
    expect(key("/")).toBeNull();
  });
});

describe("chord labels", () => {
  it("draws the modifier for the platform", () => {
    expect(chordCaps({ key: "k", mod: true }, false)).toEqual(["Ctrl", "K"]);
    expect(chordCaps({ key: "k", mod: true }, true)).toEqual(["⌘", "K"]);
    expect(chordCaps({ key: "ArrowLeft", shift: true }, false)).toEqual(["Shift", "←"]);
    expect(chordCaps({ key: " " }, false)).toEqual(["Space"]);
  });

  it("says arrows and symbols in words", () => {
    expect(chordSpoken({ key: "ArrowLeft", shift: true }, false)).toBe("Shift Left arrow");
    expect(chordSpoken({ key: "k", mod: true }, true)).toBe("Command K");
    expect(chordSpoken({ key: "[" }, false)).toBe("Left bracket");
  });
});

describe("goShortcut", () => {
  const go = (waiting: boolean, key: string, over: Partial<KeyPress> = {}) => goShortcut(waiting, press({ key }, over));

  it("waits after G, then goes where the next key says", () => {
    expect(go(false, "g")).toBe("wait");
    expect(go(true, "i")).toEqual({ href: "/inbox" });
    expect(go(true, "T")).toEqual({ href: "/today" });
    expect(go(true, ",")).toEqual({ href: "/settings" });
  });

  it("ignores a place key that was not preceded by G", () => {
    expect(go(false, "i")).toBeNull();
  });

  it("ends the wait on a key that goes nowhere", () => {
    expect(go(true, "x")).toBeNull();
  });

  it("does nothing while typing, composing, or with a modifier held", () => {
    expect(go(false, "g", { typing: true })).toBeNull();
    expect(go(true, "i", { typing: true })).toBeNull();
    expect(go(false, "g", { isComposing: true })).toBeNull();
    expect(go(false, "g", { ctrlKey: true })).toBeNull();
    expect(go(false, "g", { metaKey: true })).toBeNull();
    expect(go(false, "g", { defaultPrevented: true })).toBeNull();
  });

  it("gives every place a distinct key", () => {
    expect(new Set(GO_PLACES.map((p) => p.key)).size).toBe(GO_PLACES.length);
  });
});
