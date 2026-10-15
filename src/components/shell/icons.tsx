import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
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

export const TodayIcon = () => (
  <Icon>
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <path d="M7.5 9h5" />
    <circle cx="6" cy="9" r="1.5" fill="currentColor" />
  </Icon>
);

export const DueIcon = () => (
  <Icon>
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <path d="M2.5 7h13M6 2v3M12 2v3" />
    <path d="M9 9.5v2.2l1.4 0.8" />
  </Icon>
);

export const InboxIcon = () => (
  <Icon>
    <path d="M2.5 10.5l2-6h9l2 6v4h-13z" />
    <path d="M2.5 10.5h4l1 2h3l1-2h4" />
  </Icon>
);

export const NotesIcon = () => (
  <Icon>
    <path d="M4 2.5h7l3 3v10H4z" />
    <path d="M7 9h5M7 12h5" />
  </Icon>
);

export const ListsIcon = () => (
  <Icon>
    <path d="M3 5l1.5 1.5L7 4M3 10l1.5 1.5L7 9M9 5h6M9 10h6M9 15h6" />
  </Icon>
);

export const ThemeIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="6" />
    <path d="M9 3v12" />
  </Icon>
);

export const SignOutIcon = () => (
  <Icon>
    <path d="M7 15.5H3.5v-13H7" />
    <path d="M11 5.5L14.5 9 11 12.5M14.5 9H7" />
  </Icon>
);

export function BrandMark() {
  return (
    <svg
      viewBox="0 0 28 28"
      width={28}
      height={28}
      aria-hidden="true"
      className="flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M3 18.5h22" />
      <path d="M11 3v22" />
      <path d="M7 15.5v6M15 15.5v6M19 15.5v6M23 15.5v6" strokeWidth={1.4} />
      <circle cx="11" cy="18.5" r="2.6" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

export const WeekIcon = () => (
  <Icon>
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <path d="M6.8 3.5v11M11.2 3.5v11" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M3 5.5h12M3 12.5h12" />
    <circle cx="6.5" cy="5.5" r="1.6" fill="var(--ground, var(--paper-2))" />
    <circle cx="11.5" cy="12.5" r="1.6" fill="var(--ground, var(--paper-2))" />
  </Icon>
);

export const TagsIcon = () => (
  <Icon>
    <path d="M7 2.5l-1.5 13M12.5 2.5l-1.5 13M3 6.5h12.5M2.5 11.5H15" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="4.6" />
    <path d="M11.5 11.5L15.5 15.5" />
  </Icon>
);

/** Three dots, for the phone bar's More. */
export const MoreIcon = () => (
  <Icon>
    <circle cx="3.75" cy="9" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="9" cy="9" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="14.25" cy="9" r="1.25" fill="currentColor" stroke="none" />
  </Icon>
);
