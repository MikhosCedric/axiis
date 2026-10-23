import { describe, expect, it } from "vitest";
import { parseVisits, remember, RECENT_MAX, visitTitle, worthRemembering } from "./recent";

describe("recent visits", () => {
  it("remembers days, weeks, months, notes and tags, not the places or search and settings", () => {
    expect(["/day/2026-11-03", "/week/2026-11-02", "/month/2026-12", "/notes/abc", "/tags/home"].every(worthRemembering)).toBe(true);
    expect(["/today", "/week", "/month", "/inbox", "/notes", "/tags", "/search", "/settings", "/settings/export", "/dev/score"].some(worthRemembering)).toBe(false);
  });

  it("drops the site's name from a title", () => {
    expect(visitTitle("Week of 2 November 2026 · Axiis")).toBe("Week of 2 November 2026");
    expect(visitTitle("Garden notes")).toBe("Garden notes");
  });

  it("puts the newest first, keeps one entry per page and holds a few", () => {
    let list = remember([], { href: "/notes/a", title: "A" });
    list = remember(list, { href: "/tags/b", title: "#b" });
    list = remember(list, { href: "/notes/a", title: "A renamed" });
    expect(list).toEqual([
      { href: "/notes/a", title: "A renamed" },
      { href: "/tags/b", title: "#b" },
    ]);
    for (let i = 0; i < 10; i++) list = remember(list, { href: `/day/2026-11-0${i}`, title: `${i}` });
    expect(list).toHaveLength(RECENT_MAX);
  });

  it("reads only well-formed visits to paths in the app", () => {
    expect(parseVisits(null)).toEqual([]);
    expect(parseVisits("not json")).toEqual([]);
    expect(parseVisits('{"href":"/x"}')).toEqual([]);
    expect(
      parseVisits(
        JSON.stringify([
          { href: "/notes/a", title: "A" },
          { href: "https://evil.example", title: "B" },
          { href: "//evil.example", title: "C" },
          { href: "/tags/x", title: "" },
          { href: "/tags/y" },
        ]),
      ),
    ).toEqual([{ href: "/notes/a", title: "A" }]);
  });
});
