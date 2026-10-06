import { describe, expect, it } from "vitest";
import { listsSummary, progressShare, progressWords } from "./model";

describe("progressWords", () => {
  it("names lines done of all lines, and says when there are none or all are done", () => {
    expect(progressWords({ done: 0, total: 0 })).toBe("No lines yet");
    expect(progressWords({ done: 0, total: 4 })).toBe("0 of 4 done");
    expect(progressWords({ done: 3, total: 4 })).toBe("3 of 4 done");
    expect(progressWords({ done: 4, total: 4 })).toBe("All 4 lines done");
    expect(progressWords({ done: 1, total: 1 })).toBe("Its one line is done");
  });
});

describe("progressShare", () => {
  it("is the share done, with nothing to do reading as nothing done", () => {
    expect(progressShare({ done: 0, total: 0 })).toBe(0);
    expect(progressShare({ done: 1, total: 4 })).toBe(0.25);
    expect(progressShare({ done: 4, total: 4 })).toBe(1);
  });
});

describe("listsSummary", () => {
  const rows = (open: number, done: number) => [
    ...Array.from({ length: open }, () => ({ done: false })),
    ...Array.from({ length: done }, () => ({ done: true })),
  ];

  it("counts open and done checklists in plain words", () => {
    expect(listsSummary([])).toBe("No checklists yet.");
    expect(listsSummary(rows(1, 0))).toBe("1 checklist open.");
    expect(listsSummary(rows(3, 0))).toBe("3 checklists open.");
    expect(listsSummary(rows(2, 1))).toBe("2 open, 1 done.");
    expect(listsSummary(rows(0, 2))).toBe("None open, 2 done.");
  });
});
