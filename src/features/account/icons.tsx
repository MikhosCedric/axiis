const arrow = { up: "M9 14V4M4.5 8.5L9 4l4.5 4.5", down: "M9 4v10M4.5 9.5L9 14l4.5-4.5" } as const;

export function ArrowIcon({ direction }: { direction: keyof typeof arrow }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={16}
      height={16}
      aria-hidden="true"
      className="flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={arrow[direction]} />
    </svg>
  );
}
