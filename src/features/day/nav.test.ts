import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { dayHref, dayTitle, isTypingTarget, namesNoDay, navTarget, readDayQuery, shortcutAction, type KeyPress } from "./nav";

const d = (s: string) => s as LocalDate;
const today = d("2026-10-06");

describe("namesNoDay", () => {
  it("is true only for a /day address whose date Axiis cannot plan on", () => {
    for (const path of ["/day/2026-02-30", "/day/abc", "/day/", "/day/1969-12-31", "/day/2201-01-01", "/day/%E0%A4%A"]) {
      expect(namesNoDay(path), path).toBe(true);
    }
    for (const path of ["/day/2026-02-28", "/day/2028-02-29/", "/today", "/day", "/days/abc", "/day/2026-10-06/x"]) {
      expect(namesNoDay(path), path).toBe(false);
    }
  });
});

describe("dayHref", () => {
  it("uses /today for today and /day/<date> for any other day", () => {
    expect(dayHref(today, today, "score")).toBe("/today");
    expect(dayHref(d("2026-10-07"), today, "score")).toBe("/day/2026-10-07");
  });

  it("keeps the list view and leaves the default view out of the URL", () => {
    expect(dayHref(today, today, "list")).toBe("/today?view=list");
    expect(dayHref(d("2026-10-05"), today, "list")).toBe("/day/2026-10-05?view=list");
    expect(dayHref(d("2026-10-05"), today, "score")).not.toContain("?");
  });
});

describe("readDayQuery", () => {
  const id = "00000000-0000-4000-8000-000000000001";

  it("reads the view and the selected item", () => {
    expect(readDayQuery({ view: "list", item: id })).toEqual({ mode: "list", itemId: id });
  });

  it("reads an occurrence key, which names one day of a series", () => {
    expect(readDayQuery({ item: `${id}~2026-10-12` })).toEqual({ mode: "score", itemId: `${id}~2026-10-12` });
  });

  it("falls back to the score and no selection for anything else", () => {
    const bad = [
      { item: "not-a-uuid" },
      { item: [id, id] },
      { item: `${id}~2026-02-30` },
      { item: `${id}~tomorrow` },
      { item: `not-a-uuid~2026-10-12` },
    ];
    for (const q of [{}, { view: "week" }, { view: ["list", "list"] }, ...bad]) {
      expect(readDayQuery(q)).toEqual({ mode: "score", itemId: null });
    }
  });
});

describe("navTarget", () => {
  it("steps a day either way, or jumps to today", () => {
    expect(navTarget("previous", d("2026-03-01"), today)).toBe("2026-02-28");
    expect(navTarget("next", d("2026-12-31"), today)).toBe("2027-01-01");
    expect(navTarget("today", d("2027-01-01"), today)).toBe("2026-10-06");
  });
});

describe("shortcutAction", () => {
  const press = (over: Partial<KeyPress>): KeyPress => ({
    key: "",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false,
    typing: false,
    ...over,
  });

  it("maps [ ] and T to previous, next and today", () => {
    expect(shortcutAction(press({ key: "[" }))).toBe("previous");
    expect(shortcutAction(press({ key: "]" }))).toBe("next");
    expect(shortcutAction(press({ key: "t" }))).toBe("today");
    expect(shortcutAction(press({ key: "T" }))).toBe("today");
  });

  it("leaves browser and system combinations alone", () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(shortcutAction(press({ key: "[", ...mod }))).toBeNull();
      expect(shortcutAction(press({ key: "t", ...mod }))).toBeNull();
    }
  });

  it("does nothing while the user types or composes, or when the key was already handled", () => {
    expect(shortcutAction(press({ key: "t", typing: true }))).toBeNull();
    expect(shortcutAction(press({ key: "]", isComposing: true }))).toBeNull();
    expect(shortcutAction(press({ key: "[", defaultPrevented: true }))).toBeNull();
  });

  it("ignores other keys", () => {
    for (const key of ["{", "}", "c", "ArrowLeft", "Enter"]) expect(shortcutAction(press({ key }))).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields and editable content only", () => {
    const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable });
    expect(isTypingTarget(el("INPUT"))).toBe(true);
    expect(isTypingTarget(el("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(el("SELECT"))).toBe(true);
    expect(isTypingTarget(el("DIV", true))).toBe(true);
    expect(isTypingTarget(el("BUTTON"))).toBe(false);
    expect(isTypingTarget(el("BODY"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("dayTitle", () => {
  it("names the day with its year", () => {
    expect(dayTitle(d("2026-10-06"))).toBe("Tuesday 6 October 2026");
    expect(dayTitle(d("2028-02-29"))).toBe("Tuesday 29 February 2028");
  });
});
