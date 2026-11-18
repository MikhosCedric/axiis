"use client";

import type { ReactNode } from "react";

/**
 * A quiet chip that is a native select: the choice reads as a word with an
 * optional mark before it, and the platform's own menu does the choosing, so
 * the keyboard, a screen reader and a phone's picker all work as they do
 * everywhere else.
 */
export function ChipSelect({
  label,
  value,
  onChange,
  mark,
  children,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mark?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <span className="relative inline-flex max-w-full items-center">
      {mark && <span className="pointer-events-none absolute left-2.5 grid place-items-center">{mark}</span>}
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 max-w-full cursor-pointer appearance-none [field-sizing:content] truncate rounded-full border border-rule-soft bg-transparent pr-7 text-[13px] font-medium text-ink hover:bg-hover focus:border-field pointer-coarse:h-11 ${
          mark ? "pl-7" : "pl-3"
        }`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width={12}
        height={12}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 text-ink-3"
      >
        <path d="M4 6.5l4 4 4-4" />
      </svg>
    </span>
  );
}
