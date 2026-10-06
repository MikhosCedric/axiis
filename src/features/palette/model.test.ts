import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import type { SearchRow } from "@/features/notes/model";
import { FIND_MAX, findQuery, findStatus, paletteSections, type Find } from "./model";

const today = "2026-10-06" as LocalDate;
const idle: Find = { status: "idle" };
const labels = (input: string, find: Find = idle) =>
  Object.fromEntries(paletteSections(input, today, find).map((s) => [s.id, s.commands.map((c) => c.label)]));

const row = (n: number, over: Partial<SearchRow> = {}): SearchRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId,
  type: "note",
  title: `Row ${n}`,
  snippet: "",
  done: false,
  href: `/notes/${n}`,
  ...over,
});

describe("paletteSections", () => {
  it("offers every page, then the shortcuts, when nothing is typed", () => {
    expect(labels("   ")).toEqual({ go: ["Today", "Week", "Inbox", "Notes", "Tags", "Search", "Settings", "Keyboard shortcuts"] });
  });

  it("goes to a tag's page for #name, any spaces and case kept, and offers no capture", () => {
    const sections = paletteSections("#Deep  work", today, idle);
    expect(sections.map((s) => s.id)).toEqual(["go"]);
    expect(sections[0].commands[0]).toEqual({ kind: "go", id: "go-tag-deep work", label: "Go to #Deep work", href: "/tags/Deep%20work" });
    expect(labels("#").go).toBeUndefined();
    expect(labels("tags").go).toEqual(["Tags"]);
  });

  it("ranks pages against the typing, keywords included", () => {
    expect(labels("se").go).toEqual(["Search", "Settings", "Today", "Inbox"]);
    expect(labels("find").go).toEqual(["Search"]);
    expect(labels("export").go).toEqual(["Settings"]);
    expect(labels("unscheduled").go).toEqual(["Inbox"]);
  });

  it("links pages to their routes and the shortcuts to the help list", () => {
    const go = paletteSections("", today, idle)[0].commands;
    expect(go.find((c) => c.label === "Week")).toMatchObject({ kind: "go", href: "/week" });
    expect(go.find((c) => c.label === "Inbox")).toMatchObject({ kind: "go", href: "/inbox" });
    expect(go.find((c) => c.label === "Keyboard shortcuts")).toMatchObject({ kind: "help" });
  });

  it("offers a date for a date phrase, with no capture", () => {
    const sections = paletteSections("dec 24", today, idle);
    expect(sections.map((s) => s.id)).toEqual(["dates"]);
    expect(sections[0].commands[0]).toMatchObject({ kind: "date", label: "Go to Thursday 24 December", href: "/day/2026-12-24" });
  });

  it("adds the year when the date is in another one", () => {
    expect(labels("jan 3").dates).toEqual(["Go to Sunday 3 January 2027"]);
  });

  it("finishes a partly typed date and still offers to capture the words", () => {
    expect(labels("tom")).toMatchObject({ dates: ["Go to Wednesday 7 October"], capture: ["Capture “tom” as a task"] });
  });

  it("lets Today stand for today instead of offering it twice", () => {
    expect(labels("today")).toEqual({ go: ["Today"] });
    expect(labels("2026-10-06").dates).toEqual(["Go to Tuesday 6 October"]);
  });

  it("offers to capture any other text, trimmed", () => {
    const capture = paletteSections("  call the dentist ", today, idle).find((s) => s.id === "capture");
    expect(capture?.commands).toEqual([{ kind: "capture", id: "capture", label: "Capture “call the dentist” as a task", title: "call the dentist" }]);
  });

  it("shows search results only for the input they were found for, at most six", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i + 1));
    expect(labels("bulbs", { status: "done", query: "bulbs", rows }).find).toHaveLength(FIND_MAX);
    expect(labels("bulb", { status: "done", query: "bulbs", rows }).find).toBeUndefined();
    expect(labels("bulbs", { status: "searching", query: "bulbs" }).find).toBeUndefined();
  });

  it("opens a note in its editor and a task in the Today panel, as search links them", () => {
    const task = row(1, { type: "task", title: "Buy bulbs", href: "/today?item=1", done: true });
    const find = paletteSections("bulbs", today, { status: "done", query: "bulbs", rows: [task] }).find((s) => s.id === "find");
    expect(find?.commands[0]).toMatchObject({ kind: "open", label: "Buy bulbs", href: "/today?item=1", type: "task", done: true });
  });

  it("puts pages, dates, capture and results in that order", () => {
    const sections = paletteSections("notes", today, { status: "done", query: "notes", rows: [row(1)] });
    expect(sections.map((s) => s.id)).toEqual(["go", "capture", "find"]);
  });

  it("gives every command a distinct id", () => {
    const ids = paletteSections("se", today, { status: "done", query: "se", rows: [row(1), row(2)] }).flatMap((s) => s.commands.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findQuery and findStatus", () => {
  it("only searches two or more characters, with spaces tidied", () => {
    expect(findQuery(" a ")).toBeNull();
    expect(findQuery("  tulip   bulbs ")).toBe("tulip bulbs");
  });

  it("speaks only about the search for the current input", () => {
    expect(findStatus("bulbs", { status: "searching", query: "bulbs" })).toBe("Searching");
    expect(findStatus("bulbs", { status: "done", query: "bulbs", rows: [] })).toBe("No items or notes match.");
    expect(findStatus("bulbs", { status: "done", query: "bulb", rows: [] })).toBeNull();
    expect(findStatus("bulbs", { status: "failed", query: "bulbs" })).toMatch(/did not answer/);
    expect(findStatus("b", { status: "searching", query: "b" })).toBeNull();
  });
});
