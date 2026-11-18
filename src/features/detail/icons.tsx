import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

export const CloseIcon = () => (
  <Icon>
    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
  </Icon>
);

/** A line lifted out of its group, for promoting a subtask. */
export const LiftIcon = () => (
  <Icon>
    <path d="M6 15.5h8.5M6 11.5h8.5" />
    <path d="M3.5 7.5V2.5h5M3.5 2.5l6 6" />
  </Icon>
);

export const DeleteIcon = () => (
  <Icon>
    <path d="M3 5h12M7 5V3h4v2M4.5 5l.8 10.5h7.4L13.5 5" />
  </Icon>
);

export const BackIcon = () => (
  <Icon>
    <path d="M10.5 4.5L6 9l4.5 4.5" />
  </Icon>
);

/** Stepping over one occurrence. */
export const SkipIcon = () => (
  <Icon>
    <path d="M3 12.5c1.5-4.5 6.5-6 10-3" />
    <path d="M13.5 6.5v3.2h-3.2" />
    <path d="M4 15.5h2M12 15.5h2" />
  </Icon>
);

/** Turning back to put a skipped occurrence in place again: the skip arrow, mirrored. */
export const RestoreIcon = () => (
  <Icon>
    <path d="M15 12.5c-1.5-4.5-6.5-6-10-3" />
    <path d="M4.5 6.5v3.2h3.2" />
  </Icon>
);

/** A line that ends at a bar, for ending a series. */
export const StopIcon = () => (
  <Icon>
    <path d="M2.5 9h9" />
    <path d="M14.5 4.5v9" />
  </Icon>
);

export const CalendarIcon = () => (
  <Icon>
    <rect x="2.5" y="3.5" width="13" height="12" rx="2" />
    <path d="M2.5 7.5h13M6 2v3M12 2v3" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="6.5" />
    <path d="M9 5.5V9l2.5 1.5" />
  </Icon>
);

export const RepeatIcon = () => (
  <Icon>
    <path d="M3 8V7a2.5 2.5 0 0 1 2.5-2.5H14M11.5 2l2.5 2.5-2.5 2.5" />
    <path d="M15 10v1a2.5 2.5 0 0 1-2.5 2.5H4M6.5 16 4 13.5 6.5 11" />
  </Icon>
);

export const DueIcon = () => (
  <Icon>
    <path d="M4.5 16V2.5M4.5 3.5h9l-2 3 2 3h-9" />
  </Icon>
);

export const TagIcon = () => (
  <Icon>
    <path d="M2.5 9.5V3.5h6l7 7-6 6z" />
    <circle cx="6" cy="7" r="0.8" />
  </Icon>
);

export const NoteIcon = () => (
  <Icon>
    <path d="M4 2.5h7l3.5 3.5v9.5H4z" />
    <path d="M11 2.5V6h3.5M6.5 9.5h5M6.5 12.5h5" />
  </Icon>
);

export const MoveUpIcon = () => (
  <Icon>
    <path d="M4 11.5L9 6.5l5 5" />
  </Icon>
);

export const MoveDownIcon = () => (
  <Icon>
    <path d="M4 6.5l5 5 5-5" />
  </Icon>
);
