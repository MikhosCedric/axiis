import type { ReactNode } from "react";

export { DeleteIcon, SkipIcon } from "@/features/detail/icons";

/** One family for the cluster and its menus: an 18 grid drawn at 16px on 1.5px strokes, as the detail panel's icons are. */
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

export const DoneIcon = () => (
  <Icon>
    <path d="M3.5 9.5l3.5 3.5 7.5-8" />
  </Icon>
);

export const RenameIcon = () => (
  <Icon>
    <path d="M11.5 3.5l3 3-8 8H3.5v-3z" />
    <path d="M9.5 5.5l3 3" />
  </Icon>
);

export const PlanIcon = () => (
  <Icon>
    <rect x="2.75" y="3.75" width="12.5" height="11.5" rx="1.5" />
    <path d="M2.75 7.25h12.5M6 2.25v3M12 2.25v3" />
  </Icon>
);

export const LabelsIcon = () => (
  <Icon>
    <path d="M2.75 3.75v4.5l7 7 5.5-5.5-7-7h-4.5a1 1 0 0 0-1 1z" />
    <circle cx="6" cy="6.25" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const MoreIcon = () => (
  <Icon>
    <circle cx="4" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14" cy="9" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const DuplicateIcon = () => (
  <Icon>
    <rect x="6.25" y="6.25" width="9" height="9" rx="1.5" />
    <path d="M11.75 3.75v-.5a1 1 0 0 0-1-1h-7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h.5" />
  </Icon>
);

/** An event's beam, with the two ticks that close it. */
export const EventIcon = () => (
  <Icon>
    <path d="M3 5.5v7M15 5.5v7M3 9h12" />
  </Icon>
);

/** A task's round head on its beam. */
export const TaskIcon = () => (
  <Icon>
    <circle cx="5" cy="9" r="2.5" />
    <path d="M7.5 9H15" />
  </Icon>
);

export const InboxIcon = () => (
  <Icon>
    <path d="M2.75 10.5l2-6.75h8.5l2 6.75v3.75a1 1 0 0 1-1 1H3.75a1 1 0 0 1-1-1z" />
    <path d="M2.75 10.5h3.5l1 1.75h3.5l1-1.75h3.5" />
  </Icon>
);

export const OpenIcon = () => (
  <Icon>
    <rect x="2.75" y="3.25" width="12.5" height="11.5" rx="1.5" />
    <path d="M10.5 3.25v11.5" />
  </Icon>
);
