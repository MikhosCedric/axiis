import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { withFilter } from "@/features/filter/href";
import type { KeyPress } from "@/features/day/nav";
import { calendarView, keepSpans, spanHrefs, spanShortcut } from "./span";

const today = "2026-10-23" as LocalDate;

describe("spanHrefs", () => {
  it("names today's day, week and month by their short addresses", () => {
    expect(spanHrefs(today, today)).toEqual({ day: "/today", week: "/week", month: "/month" });
  });

  it("goes to the day, the week holding it and the month holding it", () => {
    expect(spanHrefs("2026-12-02" as LocalDate, today)).toEqual({
      day: "/day/2026-12-02",
      week: "/week/2026-11-30",
      month: "/month/2026-12",
    });
  });

  it("keeps the day's List view", () => {
    expect(spanHrefs("2026-12-02" as LocalDate, today, "list").day).toBe("/day/2026-12-02?view=list");
  });

  it("carries an area filter onto all three, the List view kept", () => {
    const keep = (href: string) => withFilter(href, { area: "Work" });
    expect(keepSpans(spanHrefs("2026-12-02" as LocalDate, today, "list"), keep)).toEqual({
      day: "/day/2026-12-02?view=list&area=Work",
      week: "/week/2026-11-30?area=Work",
      month: "/month/2026-12?area=Work",
    });
  });

  it("names the month a week's Monday falls in from that Monday", () => {
    expect(spanHrefs("2026-09-28" as LocalDate, today).month).toBe("/month/2026-09");
  });
});

describe("calendarView", () => {
  const d = (s: string) => s as LocalDate;

  it("reads a day, with that day alone in view", () => {
    expect(calendarView("/today", today)).toEqual({ span: "day", anchor: today, from: today, to: today });
    expect(calendarView("/day/2026-12-02", today)).toEqual({ span: "day", anchor: d("2026-12-02"), from: d("2026-12-02"), to: d("2026-12-02") });
  });

  it("reads a week from the reader's week start, anchored on today when it holds today", () => {
    expect(calendarView("/week", today)).toEqual({ span: "week", anchor: today, from: d("2026-10-19"), to: d("2026-10-25") });
    expect(calendarView("/week", today, 0)).toMatchObject({ from: d("2026-10-18"), to: d("2026-10-24") });
    expect(calendarView("/week/2026-12-02", today)).toEqual({ span: "week", anchor: d("2026-11-30"), from: d("2026-11-30"), to: d("2026-12-06") });
  });

  it("reads a month, first day to last", () => {
    expect(calendarView("/month", today)).toEqual({ span: "month", anchor: today, from: d("2026-10-01"), to: d("2026-10-31") });
    expect(calendarView("/month/2027-02", today)).toEqual({ span: "month", anchor: d("2027-02-01"), from: d("2027-02-01"), to: d("2027-02-28") });
  });

  it("has no span and no days in view anywhere else, or for an address that names no day", () => {
    const none = { span: null, anchor: today, from: null, to: null };
    for (const path of ["/inbox", "/due", "/notes/abc", "/day/nonsense", "/month/2026-13", "/today/extra"]) {
      expect(calendarView(path, today), path).toEqual(none);
    }
  });
});

describe("spanShortcut", () => {
  const press = (key: string, over: Partial<KeyPress> = {}): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    defaultPrevented: false,
    typing: false,
    ...over,
  });

  it("answers D, W and M in either case", () => {
    expect(["d", "W", "m"].map((k) => spanShortcut(press(k)))).toEqual(["day", "week", "month"]);
  });

  it("stays out of the way while typing, with a modifier, or when an item took the key", () => {
    expect(spanShortcut(press("d", { typing: true }))).toBeNull();
    expect(spanShortcut(press("w", { ctrlKey: true }))).toBeNull();
    expect(spanShortcut(press("d", { defaultPrevented: true }))).toBeNull();
    expect(spanShortcut(press("x"))).toBeNull();
  });
});
