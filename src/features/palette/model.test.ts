import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import type { SearchRow } from "@/features/notes/model";
import { quickItem, quickNote } from "@/features/actions/quick-item";
import { makeItem } from "@/features/today/test-support";
import { actedLine, actSections, commandSections, FIND_MAX, findQuery, findStatus, leadsWithMatch, paletteSections, planDay, sameTitle, type Find, type Target } from "./model";

const today = "2026-10-06" as LocalDate;
const idle: Find = { status: "idle" };
const labels = (input: string, find: Find = idle) =>
  Object.fromEntries(paletteSections(input, today, "24", find).map((s) => [s.id, s.commands.map((c) => c.label)]));

const row = (n: number, over: Partial<SearchRow> = {}): SearchRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId,
  type: "note",
  title: `Row ${n}`,
  snippet: "",
  done: false,
  href: `/notes/${n}`,
  quick: quickNote({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, title: `Row ${n}` }),
  ...over,
});

describe("paletteSections", () => {
  it("offers every page, then the Guide, when nothing is typed", () => {
    expect(labels("   ")).toEqual({ go: ["Today", "Week", "Month", "Inbox", "Due", "Done", "Lists", "Notes", "Tags", "Search", "Settings", "Help", "Guide"] });
  });

  it("puts the pages visited lately before every page when nothing is typed, and names each page's G key", () => {
    const recent = [
      { href: "/notes/a", title: "Garden notes" },
      { href: "/week/2026-11-02", title: "Week of 2 November 2026" },
    ];
    const sections = paletteSections("", today, "24", idle, null, recent);
    expect(sections.map((s) => [s.id, s.label])).toEqual([
      ["recent", "Recent"],
      ["go", "Go to"],
    ]);
    expect(sections[0].commands).toEqual([
      { kind: "go", id: "recent-/notes/a", label: "Garden notes", href: "/notes/a" },
      { kind: "go", id: "recent-/week/2026-11-02", label: "Week of 2 November 2026", href: "/week/2026-11-02" },
    ]);
    expect(sections[1].commands.find((c) => c.label === "Inbox")).toMatchObject({ go: "i" });
    expect(sections[1].commands.find((c) => c.label === "Search")).toMatchObject({ go: "s" });
    expect(paletteSections("garden", today, "24", idle, null, recent).map((s) => s.id)).not.toContain("recent");
  });

  it("says in a few words what each page and the Guide hold", () => {
    const go = paletteSections("", today, "24", idle)[0].commands;
    expect(go.find((c) => c.label === "Inbox")).toMatchObject({ hint: "Captured, with no day yet" });
    expect(go.find((c) => c.label === "Guide")).toMatchObject({ hint: "Help and every shortcut" });
    expect(go.every((c) => (c.kind === "go" || c.kind === "help") && c.hint)).toBe(true);
  });

  it("goes to a tag's page for #name, any spaces and case kept, and offers no capture", () => {
    const sections = paletteSections("#Deep  work", today, "24", idle);
    expect(sections.map((s) => s.id)).toEqual(["go"]);
    expect(sections[0].commands[0]).toEqual({ kind: "go", id: "go-tag-deep work", label: "Go to #Deep work", href: "/tags/Deep%20work" });
    expect(labels("#").go).toBeUndefined();
    expect(labels("tags").go).toEqual(["Tags"]);
  });

  it("ranks pages against the typing, keywords included", () => {
    expect(labels("se").go).toEqual(["Search", "Settings", "Inbox", "Help"]);
    expect(labels("find").go).toEqual(["Search"]);
    expect(labels("export").go).toEqual(["Settings"]);
    expect(labels("unscheduled").go).toEqual(["Inbox"]);
    expect(labels("checkl").go).toEqual(["Lists"]);
    expect(labels("deadline").go).toEqual(["Due"]);
  });

  it("links pages to their routes and the Guide to the help dialog", () => {
    const go = paletteSections("", today, "24", idle)[0].commands;
    expect(go.find((c) => c.label === "Week")).toMatchObject({ kind: "go", href: "/week" });
    expect(go.find((c) => c.label === "Inbox")).toMatchObject({ kind: "go", href: "/inbox" });
    expect(go.find((c) => c.label === "Lists")).toMatchObject({ kind: "go", href: "/lists" });
    expect(go.find((c) => c.label === "Guide")).toMatchObject({ kind: "help" });
  });

  it("offers a date for a date phrase, with no capture", () => {
    const sections = paletteSections("dec 24", today, "24", idle);
    expect(sections.map((s) => s.id)).toEqual(["dates"]);
    expect(sections[0].commands[0]).toMatchObject({ kind: "date", label: "Go to Thursday 24 December", href: "/day/2026-12-24" });
  });

  it("offers a month for a month phrase, with no capture", () => {
    const sections = paletteSections("month november", today, "24", idle);
    expect(sections.map((s) => s.id)).toEqual(["dates"]);
    expect(sections[0].commands[0]).toMatchObject({ kind: "date", label: "Go to November 2026", href: "/month/2026-11" });
    expect(labels("nov 2027").dates).toEqual(["Go to November 2027"]);
    expect(labels("month october").dates).toEqual(["Go to October 2026"]);
    expect(paletteSections("month october", today, "24", idle)[0].commands[0]).toMatchObject({ href: "/month" });
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
    const capture = paletteSections("  call the dentist ", today, "24", idle).find((s) => s.id === "capture");
    expect(capture?.commands).toEqual([{ kind: "capture", id: "capture", label: "Capture “call the dentist” as a task", title: "call the dentist" }]);
  });

  it("says what capture will understand, and sends the words as typed", () => {
    const capture = paletteSections("dentist tomorrow 9:00 #health", today, "24", idle).find((s) => s.id === "capture");
    expect(capture?.commands).toEqual([
      {
        kind: "capture",
        id: "capture",
        label: "Capture “dentist” as a task: tomorrow, 09:00, #health",
        title: "dentist tomorrow 9:00 #health",
      },
    ]);
  });

  it("shows search results only for the input they were found for, at most six", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i + 1));
    expect(labels("bulbs", { status: "done", query: "bulbs", rows }).find).toHaveLength(FIND_MAX);
    expect(labels("bulb", { status: "done", query: "bulbs", rows }).find).toBeUndefined();
    expect(labels("bulbs", { status: "searching", query: "bulbs" }).find).toBeUndefined();
  });

  it("opens a note in its editor and a task in the Today panel, as search links them", () => {
    const task = row(1, { type: "task", title: "Buy bulbs", href: "/today?item=1", done: true });
    const find = paletteSections("bulbs", today, "24", { status: "done", query: "bulbs", rows: [task] }).find((s) => s.id === "find");
    expect(find?.commands[0]).toMatchObject({
      kind: "open",
      label: "Buy bulbs",
      target: { key: task.id, title: "Buy bulbs", href: "/today?item=1", type: "task", done: true },
    });
  });

  it("puts pages, dates, capture and results in that order", () => {
    const sections = paletteSections("notes", today, "24", { status: "done", query: "notes", rows: [row(1)] });
    expect(sections.map((s) => s.id)).toEqual(["go", "capture", "find"]);
  });

  it("puts an item named exactly what was typed first, with Capture after it as a new task", () => {
    const dentist = row(1, { type: "event", title: "Dentist", href: "/today?item=1" });
    for (const typed of ["dentist", " Dentist ", "DENTIST."]) {
      const sections = paletteSections(typed, today, "24", { status: "done", query: typed.trim(), rows: [row(2, { title: "Dentist notes" }), dentist] });
      expect(sections.map((s) => s.id)).toEqual(["find", "capture"]);
      expect(sections[0].commands.map((c) => c.label)).toEqual(["Dentist", "Dentist notes"]);
      expect(sections[1].commands[0].label).toBe(`Capture “${typed.trim()}” as a new task`);
      expect(leadsWithMatch(sections)).toBe(true);
    }
  });

  it("keeps Capture first when no item is named exactly what was typed, or the line plans a day", () => {
    const dentist = row(1, { type: "event", title: "Dentist" });
    expect(paletteSections("dent", today, "24", { status: "done", query: "dent", rows: [dentist] }).map((s) => s.id)).toEqual(["capture", "find"]);
    const planned = paletteSections("dentist tomorrow", today, "24", { status: "done", query: "dentist tomorrow", rows: [dentist] });
    expect(planned.map((s) => s.id)).toEqual(["capture", "find"]);
    expect(sameTitle("Dentist", "dentist")).toBe(true);
    expect(sameTitle("Dentist", "dentist visit")).toBe(false);
    expect(sameTitle("", " ")).toBe(false);
  });

  it("says why a repeat with no title will be captured as typed", () => {
    expect(labels("every sunday").capture).toEqual(["Capture “every sunday” as a task. Add what to do: “every sunday” alone has no title"]);
  });

  it("gives every command a distinct id", () => {
    const ids = paletteSections("se", today, "24", { status: "done", query: "se", rows: [row(1), row(2)] }).flatMap((s) => s.commands.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const task: Target = { key: "k1", title: "dentist", type: "task", done: false, href: "/today?item=k1" };

describe("the selected item", () => {
  it("comes first when nothing is typed, and goes once typing starts", () => {
    const sections = paletteSections("", today, "24", idle, { ...task, href: null });
    expect(sections.map((s) => s.id)).toEqual(["selected", "go"]);
    expect(sections[0].commands).toEqual([{ kind: "open", id: "selected", label: "dentist", detail: "", target: { ...task, href: null } }]);
    expect(paletteSections("we", today, "24", idle, task).map((s) => s.id)).not.toContain("selected");
  });
});

describe("actSections", () => {
  const acts = (input: string, target: Target = task) => actSections(input, target).flatMap((s) => s.commands.map((c) => c.label));

  it("offers open, done, a day and a tag, under the item's name", () => {
    const sections = actSections("", task);
    expect(sections.map((s) => s.label)).toEqual(["Actions for “dentist”"]);
    expect(sections[0].commands.map((c) => (c.kind === "act" ? c.act : null))).toEqual([
      { do: "open", href: "/today?item=k1" },
      { do: "done", done: true },
      { do: "plan", when: "today" },
      { do: "plan", when: "tomorrow" },
      { do: "plan", when: "next-week" },
      { do: "ask-tag" },
      { do: "delete", scope: "one" },
    ]);
    expect(acts("")).toEqual(["Open details", "Mark done", "Plan for today", "Plan for tomorrow", "Plan for next week", "Add a tag", "Delete"]);
  });

  it("offers to open a done item again, leaves Open out for the selected item, and gives a note only open and tag", () => {
    expect(acts("", { ...task, done: true })).toContain("Mark open again");
    expect(acts("", { ...task, href: null })).toEqual(["Mark done", "Plan for today", "Plan for tomorrow", "Plan for next week", "Add a tag", "Delete"]);
    expect(acts("", { ...task, type: "note", quick: quickNote({ id: "k1", title: "dentist" }) })).toEqual(["Open", "Duplicate", "Add a tag", "Delete"]);
  });

  it("filters by the typing and its other words", () => {
    expect(acts("tom")).toEqual(["Plan for tomorrow"]);
    expect(acts("complete")).toEqual(["Mark done"]);
    expect(acts("zzz")).toEqual([]);
  });

  it("turns # and a name into that tag, cleaned the way tags are", () => {
    expect(actSections("#  Deep  work", task)[0].commands).toEqual([
      { kind: "act", id: "act-tag", label: "Tag #Deep work", act: { do: "tag", name: "Deep work" } },
    ]);
    expect(actSections("#", task)).toEqual([]);
  });

  it("offers what the item allows: Inbox for a planned one, a copy to tomorrow, and the other type", () => {
    const planned = makeItem({ title: "dentist", schedule: { kind: "day", on: "2026-10-07" as LocalDate } });
    const target: Target = { key: planned.id, title: "dentist", type: "task", done: false, href: null, quick: quickItem(planned, "UTC") };
    expect(acts("", target)).toEqual([
      "Mark done",
      "Plan for today",
      "Plan for tomorrow",
      "Plan for next week",
      "Move to Inbox",
      "Duplicate to tomorrow",
      "Make event",
      "Add a tag",
      "Delete",
    ]);
    const event = { ...target, type: "event" as const, quick: { ...target.quick!, type: "event" as const, day: null } };
    expect(acts("", event)).toContain("Make task");
    expect(acts("", event)).not.toContain("Move to Inbox");
    expect(acts("inbox", target)).toEqual(["Move to Inbox"]);
    expect(acts("next week", target)).toEqual(["Plan for next week"]);
  });

  it("asks what Delete means for a series and for one time it happens, and never plans a series' own row", () => {
    const quick = quickItem(makeItem({ title: "stretch" }), "UTC");
    const time = { ...task, quick: { ...quick, series: "occurrence" as const } };
    expect(acts("", time)).toEqual(expect.arrayContaining(["Skip on this day", "Delete every time"]));
    expect(acts("", time)).not.toContain("Delete");
    const own = { ...task, quick: { ...quick, series: "series" as const } };
    expect(acts("", own)).toEqual(["Open details", "Mark done", "Duplicate to tomorrow", "Make event", "Add a tag", "Delete every time"]);
    expect(actSections("skip", time)[0].commands.map((c) => (c.kind === "act" ? c.act : null))).toEqual([{ do: "delete", scope: "one" }]);
  });

  it("works out next week from the first day of the week", () => {
    expect(planDay("next-week", today)).toBe("2026-10-12");
    expect(planDay("next-week", today, 0)).toBe("2026-10-11");
    expect(planDay("tomorrow", today)).toBe("tomorrow");
  });

  it("says what each action did", () => {
    expect(actedLine({ do: "plan", when: "next-week" }, "dentist")).toBe("“dentist” is planned for next week.");
    expect(actedLine({ do: "inbox" }, "dentist")).toBe("“dentist” is in the Inbox.");
    expect(actedLine({ do: "duplicate", tomorrow: true }, "dentist")).toBe("“dentist” is copied to tomorrow.");
    expect(actedLine({ do: "type", type: "event" }, "dentist")).toBe("“dentist” is an event now.");
    expect(actedLine({ do: "delete", scope: "all" }, "dentist")).toBe("“dentist” is deleted, every time.");
    expect(actedLine({ do: "done", done: true }, "dentist")).toBe("“dentist” is done.");
    expect(actedLine({ do: "done", done: false }, "dentist")).toBe("“dentist” is open again.");
    expect(actedLine({ do: "plan", when: "tomorrow" }, "dentist")).toBe("“dentist” is planned for tomorrow.");
    expect(actedLine({ do: "tag", name: "health" as TagName }, "dentist")).toBe("“dentist” is tagged #health.");
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

describe("commandSections", () => {
  const now = { density: "spacious", weekStart: "monday", theme: "system", reminders: null } as const;
  const names = (input: string, over = {}) => commandSections(input, { ...now, ...over }).flatMap((s) => s.commands.map((c) => c.label));

  it("offers nothing until something is typed, then only what matches", () => {
    expect(names("")).toEqual([]);
    expect(names("compact")).toEqual(["Density: compact"]);
    expect(names("dark")).toEqual(["Theme: dark"]);
    expect(names("sunday")).toEqual(["Week starts on Sunday"]);
    expect(names("zzz")).toEqual([]);
  });

  it("leaves out the switch that is already made", () => {
    expect(names("density", { density: "compact" })).toEqual(["Density: spacious"]);
    expect(names("theme", { theme: "dark" })).toEqual(["Theme: light", "Theme: follow the system"]);
    expect(names("week starts", { weekStart: "sunday" })).toEqual(["Week starts on Monday"]);
  });

  it("offers reminders only in the desktop app, as the opposite of what they are", () => {
    expect(names("reminders")).toEqual([]);
    expect(names("reminders", { reminders: true })).toEqual(["Turn reminders off"]);
    expect(names("reminders", { reminders: false })).toEqual(["Turn reminders on"]);
  });

  it("offers the rest of today for tomorrow", () => {
    const [section] = commandSections("rest of today", now);
    expect(section.commands).toEqual([{ kind: "run", id: "run-rest", label: "Plan the rest of today for tomorrow", run: { do: "rest" } }]);
    expect(names("plan the rest")).toEqual(["Plan the rest of today for tomorrow"]);
  });

  it("gives each command its own id", () => {
    const ids = commandSections("e", now).flatMap((s) => s.commands.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
