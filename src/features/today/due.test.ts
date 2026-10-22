import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { dueWords } from "./due";

const today = "2026-10-23" as LocalDate;
const d = (s: string) => s as LocalDate;

describe("dueWords", () => {
  it("names a due date from today without counting days late", () => {
    expect(dueWords(d("2026-10-01"), today)).toEqual({ words: "Past due", near: true });
    expect(dueWords(today, today)).toEqual({ words: "Due today", near: true });
    expect(dueWords(d("2026-10-24"), today)).toEqual({ words: "Due tomorrow", near: false });
    expect(dueWords(d("2026-10-27"), today)).toEqual({ words: "Due Tue", near: false });
    expect(dueWords(d("2026-11-03"), today)).toEqual({ words: "Due 3 Nov", near: false });
  });
});
