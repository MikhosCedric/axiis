import { describe, expect, it } from "vitest";
import type { TagName } from "@/domain/tag";
import { openCount, splitTagTerms, suggestTags, SUGGESTIONS_MAX, tagHref } from "./model";

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

describe("words", () => {
  it("links a tag page by its name, escaped", () => {
    expect(tagHref("Deep work")).toBe("/tags/Deep%20work");
    expect(tagHref("a/b?c")).toBe("/tags/a%2Fb%3Fc");
  });

  it("says how many are open without making none sound like a problem", () => {
    expect([openCount(0), openCount(1), openCount(12)]).toEqual(["None open", "1 open", "12 open"]);
  });
});
