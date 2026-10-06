/**
 * A small loop drawn beside anything that repeats. It is a shape, not a colour,
 * and decorative: the item's accessible name says "repeats" in words.
 */
export function RepeatMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={11}
      height={11}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block flex-none align-[-1px] ${className}`}
    >
      <path d="M2 5.5a4 4 0 0 1 7-2.4M10 6.5a4 4 0 0 1-7 2.4" />
      <path d="M9.4 1.2v2.2H7.2M2.6 10.8V8.6h2.2" />
    </svg>
  );
}
