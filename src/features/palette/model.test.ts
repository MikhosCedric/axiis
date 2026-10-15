import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import type { SearchRow } from "@/features/notes/model";
import { actedLine, actSections, FIND_MAX, findQuery, findStatus, paletteSections, type Find, type Target } from "./model";

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
  it("offers every page, then the Guide, when nothing is typed", () => {
    expect(labels("   ")).toEqual({ go: ["Today", "Week", "Due", "Inbox", "Lists", "Notes", "Tags", "Search", "Settings", "Guide"] });
  });

  it("says in a few words what each page and the Guide hold", () => {
    const go = paletteSections("", today, idle)[0].commands;
    expect(go.find((c) => c.label === "Inbox")).toMatchObject({ hint: "Waiting for a day" });
    expect(go.find((c) => c.label === "Guide")).toMatchObject({ hint: "Help and every shortcut" });
    expect(go.every((c) => (c.kind === "go" || c.kind === "help") && c.hint)).toBe(true);
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
    expect(labels("checkl").go).toEqual(["Lists"]);
    expect(labels("deadline").go).toEqual(["Due"]);
  });

  it("links pages to their routes and the Guide to the help dialog", () => {
    const go = paletteSections("", today, idle)[0].commands;
    expect(go.find((c) => c.label === "Week")).toMatchObject({ kind: "go", href: "/week" });
    expect(go.find((c) => c.label === "Inbox")).toMatchObject({ kind: "go", href: "/inbox" });
    expect(go.find((c) => c.label === "Lists")).toMatchObject({ kind: "go", href: "/lists" });
    expect(go.find((c) => c.label === "Guide")).toMatchObject({ kind: "help" });
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

  it("says what capture will understand, and sends the words as typed", () => {
    const capture = paletteSections("dentist tomorrow 9:00 #health", today, idle).find((s) => s.id === "capture");
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
    const find = paletteSections("bulbs", today, { status: "done", query: "bulbs", rows: [task] }).find((s) => s.id === "find");
    expect(find?.commands[0]).toMatchObject({
      kind: "open",
      label: "Buy bulbs",
      target: { key: task.id, title: "Buy bulbs", href: "/today?item=1", type: "task", done: true },
    });
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

const task: Target = { key: "k1", title: "dentist", type: "task", done: false, href: "/today?item=k1" };

describe("the selected item", () => {
  it("comes first when nothing is typed, and goes once typing starts", () => {
    const sections = paletteSections("", today, idle, { ...task, href: null });
    expect(sections.map((s) => s.id)).toEqual(["selected", "go"]);
    expect(sections[0].commands).toEqual([{ kind: "open", id: "selected", label: "dentist", detail: "", target: { ...task, href: null } }]);
    expect(paletteSections("we", today, idle, task).map((s) => s.id)).not.toContain("selected");
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
      { do: "ask-tag" },
    ]);
    expect(acts("")).toEqual(["Open", "Mark done", "Plan for today", "Plan for tomorrow", "Add a tag"]);
  });

  it("offers to open a done item again, leaves Open out for the selected item, and gives a note only open and tag", () => {
    expect(acts("", { ...task, done: true })).toContain("Mark open again");
    expect(acts("", { ...task, href: null })).toEqual(["Mark done", "Plan for today", "Plan for tomorrow", "Add a tag"]);
    expect(acts("", { ...task, type: "note" })).toEqual(["Open", "Add a tag"]);
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

  it("says what each action did", () => {
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
