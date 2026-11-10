import { describe, expect, it } from "vitest";
import { forget, moveVisit } from "@/features/palette/recent";
import { deletePrompt } from "./model";
import { isTagPage, visitsAfterDelete, visitsAfterRename } from "./tag-pages";

const recent = [
  { href: "/tags/Deep%20work", title: "#Deep work" },
  { href: "/notes/abc", title: "Garden notes" },
  { href: "/tags/errands", title: "#errands" },
];

describe("a tag's page in what the browser keeps", () => {
  it("knows a tag's page however its name is cased or encoded", () => {
    expect(isTagPage("/tags/Deep%20work", "deep work")).toBe(true);
    expect(isTagPage("/tags/ERRANDS", "errands")).toBe(true);
    expect(isTagPage("/tags/errands-old", "errands")).toBe(false);
    expect(isTagPage("/tags", "errands")).toBe(false);
    expect(isTagPage("/notes/errands", "errands")).toBe(false);
  });

  it("forgets a deleted tag's page in Recent and keeps the rest", () => {
    expect(visitsAfterDelete(recent, "Deep work")).toEqual([recent[1], recent[2]]);
  });

  it("points a renamed tag's visit at its new page and title", () => {
    expect(visitsAfterRename(recent, "errands", "chores")).toEqual([recent[0], recent[1], { href: "/tags/chores", title: "#chores" }]);
  });

  it("keeps one visit when a rename lands on a page already in Recent", () => {
    const list = [{ href: "/tags/chores", title: "#chores" }, ...recent];
    expect(moveVisit(list, "/tags/errands", { href: "/tags/chores", title: "#chores" }).filter((v) => v.href === "/tags/chores")).toHaveLength(1);
  });

  it("matches a visit by its path, whatever its query", () => {
    expect(forget([{ href: "/tags/errands?item=1", title: "#errands" }], "/tags/errands")).toEqual([]);
  });
});

describe("deletePrompt", () => {
  it("says how many open items lose the tag, and that the items stay", () => {
    expect(deletePrompt({ name: "errands", open: 3 })).toBe("Delete #errands? It comes off 3 open items. The items stay.");
    expect(deletePrompt({ name: "errands", open: 1 })).toBe("Delete #errands? It comes off 1 open item. The items stay.");
    expect(deletePrompt({ name: "errands", open: 0 })).toBe("Delete #errands? The items stay.");
    expect(deletePrompt({ name: "errands" })).toBe("Delete #errands? The items stay.");
  });
});
