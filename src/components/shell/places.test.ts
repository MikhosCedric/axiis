import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { GO_PLACES } from "@/features/palette/shortcuts";
import { PLACE_GROUPS, PLACES } from "./places";

const today = "2026-10-06" as LocalDate;

describe("PLACES", () => {
  it("groups the rail's places as Plan, Capture and Library", () => {
    const grouped = Object.fromEntries(PLACE_GROUPS.map((g) => [g, PLACES.filter((p) => p.group === g).map((p) => p.label)]));
    expect(grouped).toEqual({ Plan: ["Today", "Week", "Due"], Capture: ["Inbox"], Library: ["Lists", "Notes", "Tags"] });
  });

  it("keeps four tabs for the phone bar", () => {
    expect(PLACES.filter((p) => p.tab).map((p) => p.label)).toEqual(["Today", "Week", "Due", "Inbox"]);
  });

  it("gives every place a short hint, and each place knows its own page", () => {
    for (const p of PLACES) {
      expect(p.hint.length, p.label).toBeGreaterThan(0);
      expect(p.hint.length, p.label).toBeLessThanOrEqual(40);
      expect(p.here(p.href, today), p.label).toBe(true);
    }
    expect(PLACES.find((p) => p.id === "today")!.here(`/day/${today}`, today)).toBe(true);
  });

  it("keeps Search and Settings off the rail's lists but reachable by G and a key", () => {
    expect(PLACES.filter((p) => p.group === null).map((p) => p.label)).toEqual(["Search", "Settings"]);
    expect(GO_PLACES.map((p) => [p.key, p.href])).toEqual([
      ["t", "/today"],
      ["w", "/week"],
      ["d", "/due"],
      ["i", "/inbox"],
      ["l", "/lists"],
      ["n", "/notes"],
      ["s", "/search"],
      [",", "/settings"],
    ]);
  });
});
