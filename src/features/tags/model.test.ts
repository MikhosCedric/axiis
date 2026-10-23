import { describe, expect, it } from "vitest";
import type { TagId, TagName } from "@/domain/tag";
import {
  byUse,
  openCount,
  splitTagTerms,
  suggestTags,
  SUGGESTIONS_MAX,
  taggedSummary,
  tagFromSegment,
  tagHref,
  tagLine,
} from "./model";

const names = (...n: string[]) => n as TagName[];

describe("suggestTags", () => {
  const all = names("errands", "Deep work", "home", "deadline", "reading", "health", "garden", "admin");

  it("offers matches not on the item yet, prefix before substring, ignoring case and a leading #", () => {
    expect(suggestTags(all, names("Deep work"), "#DE")).toEqual(["deadline", "garden"]);
    expect(suggestTags(all, [], "ea")).toEqual(["deadline", "reading", "health", "errands"]);
    expect(suggestTags(all, [], "e")).toHaveLength(SUGGESTIONS_MAX);
  });

  it("offers the given order when nothing is typed, leaving out tags the item has in any case", () => {
    expect(suggestTags(all, names("ERRANDS", "home"), "  ")).toEqual(names("Deep work", "deadline", "reading", "health", "garden", "admin"));
    expect(suggestTags(all, [], "zzz")).toEqual([]);
  });
});

describe("byUse", () => {
  it("puts the tags with most open items first, ties by name", () => {
    const t = (name: string, open: number) => ({ id: name as TagId, name: name as TagName, color: null, open });
    expect(byUse([t("home", 1), t("deep", 4), t("Admin", 1), t("zen", 0)])).toEqual(["deep", "Admin", "home", "zen"]);
  });
});

describe("splitTagTerms", () => {
  it("takes #words out as tags, once each in any case, and keeps the rest as text", () => {
    expect(splitTagTerms("  invoice #Work  march #work #home ")).toEqual({ text: "invoice march", tags: ["Work", "home"] });
    expect(splitTagTerms("#deep")).toEqual({ text: "", tags: ["deep"] });
  });

  it("leaves a bare # and a # inside a word as text", () => {
    expect(splitTagTerms("c# #")).toEqual({ text: "c# #", tags: [] });
    expect(splitTagTerms("")).toEqual({ text: "", tags: [] });
  });
});

describe("tagLine", () => {
  it("shows the first few with a count of the rest, and says all of them", () => {
    expect(tagLine(["home", "errands", "Deep work", "admin"], 2)).toEqual({
      shown: "#home #errands +2",
      spoken: "tagged home, errands, Deep work and admin",
    });
    expect(tagLine(["home"])).toEqual({ shown: "#home", spoken: "tagged home" });
    expect(tagLine(["a", "b", "c"])).toEqual({ shown: "#a #b #c", spoken: "tagged a, b and c" });
    expect(tagLine([])).toEqual({ shown: "", spoken: "" });
  });
});

describe("words", () => {
  it("links a tag page by its name, escaped", () => {
    expect(tagHref("Deep work")).toBe("/tags/Deep%20work");
    expect(tagHref("a/b?c")).toBe("/tags/a%2Fb%3Fc");
  });

  it("says how many are open without making none sound like a problem", () => {
    expect([openCount(0), openCount(1), openCount(12)]).toEqual(["None open", "1 open", "12 open"]);
  });

  it("sums up a tag's page by open and done", () => {
    const rows = (open: number, done: number) => [
      ...Array.from({ length: open }, () => ({ done: false })),
      ...Array.from({ length: done }, () => ({ done: true })),
    ];
    expect(taggedSummary([])).toBe("Nothing carries this tag right now.");
    expect(taggedSummary(rows(3, 0))).toBe("3 open.");
    expect(taggedSummary(rows(2, 1))).toBe("2 open, 1 done.");
    expect(taggedSummary(rows(0, 4))).toBe("None open, 4 done.");
  });
});

describe("tagFromSegment", () => {
  it("reads back the name a tag link was made from", () => {
    for (const name of ["Deep work", "a/b?c", "50%", "a%20b", "café"]) {
      expect(tagFromSegment(tagHref(name).slice("/tags/".length))).toBe(name);
    }
  });

  it("takes a segment that is not valid encoding as it is", () => {
    expect(tagFromSegment("50%")).toBe("50%");
  });
});
