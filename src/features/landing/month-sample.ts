import type { LocalDate } from "@/domain/item";

/** One mark on a day of the sample month: a day-only item (`at` null), a timed one, or a due date. */
export type SampleMark = { title: string; at: number | null; due: boolean };

/** The most marks a day cell draws, as on the Month; the rest is a count. */
export const SAMPLE_MARKS_PER_DAY = 3;

const plain = (title: string, at: number | null = null): SampleMark => ({ title, at, due: false });
const due = (title: string): SampleMark => ({ title, at: null, due: true });

const BY_WEEKDAY: Record<number, SampleMark[]> = {
  1: [plain("Easy run", 7 * 60)],
  2: [plain("Stand-up", 9 * 60 + 30)],
  3: [plain("Easy run", 7 * 60)],
  4: [plain("Stand-up", 9 * 60 + 30)],
  5: [plain("Easy run", 7 * 60)],
  6: [plain("Groceries")],
};

const BY_DATE: Record<number, SampleMark[]> = {
  3: [due("Pay the rent")],
  9: [plain("Physio exercises", 13 * 60)],
  14: [plain("Dentist", 9 * 60), plain("Call the landlord", 12 * 60 + 30)],
  21: [plain("Birthday card for Sam")],
  23: [plain("Physio exercises", 13 * 60), plain("Plan next week", 14 * 60)],
  26: [due("Quarterly summary")],
};

/**
 * Made-up marks for any date, the same every month: a few weekly habits and a handful of fixed days.
 * Ordered as the Month orders them: day-only items, then timed ones by start, then due dates.
 */
export function sampleMarks(date: LocalDate): SampleMark[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const marks = [...(BY_WEEKDAY[weekday] ?? []), ...(BY_DATE[Number(date.slice(8))] ?? [])];
  const rank = (m: SampleMark) => (m.due ? 2 : m.at === null ? 0 : 1);
  return marks.sort((a, b) => rank(a) - rank(b) || (a.at ?? 0) - (b.at ?? 0));
}
