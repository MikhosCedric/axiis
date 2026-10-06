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

/** A line that ends at a bar, for ending a series. */
export const StopIcon = () => (
  <Icon>
    <path d="M2.5 9h9" />
    <path d="M14.5 4.5v9" />
  </Icon>
);
