import type { LocalDate } from "@/domain/item";
import { dueWords } from "./due";

/**
 * The one quiet sign of a due date, wherever an item is drawn: a small flag and words ("Due today", "Past due",
 * "Due Tue"). The flag is filled once the date has come, outlined before it. Never red, never a count of days late.
 */
export function DueMark({ dueOn, today, className = "" }: { dueOn: LocalDate; today: LocalDate; className?: string }) {
  const { words, near } = dueWords(dueOn, today);
  return (
    <span data-due={near ? "near" : "later"} className={`inline-flex items-center gap-1 whitespace-nowrap ${near ? "font-semibold text-ink-2" : ""} ${className}`}>
      <svg viewBox="0 0 10 12" width={9} height={11} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
        <path d="M1.5 11.5V1" strokeLinecap="round" />
        <path d="M1.5 1.5h6.5L6.4 4.2 8 7H1.5" fill={near ? "currentColor" : "none"} />
      </svg>
      {words}
    </span>
  );
}
