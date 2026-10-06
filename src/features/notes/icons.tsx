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

export const HeadingIcon = () => (
  <Icon>
    <path d="M3.5 3.5v11M10.5 3.5v11M3.5 9h7" />
    <path d="M13 8.5l2-1.5v7.5" />
  </Icon>
);

export const SubheadingIcon = () => (
  <Icon>
    <path d="M4 5v8M10 5v8M4 9h6" />
    <path d="M13 11.5h2.5M13 9.5h2.5" />
  </Icon>
);

export const BoldIcon = () => (
  <Icon>
    <path d="M5 3.5h4.5a2.75 2.75 0 010 5.5H5zM5 9h5.25a2.75 2.75 0 010 5.5H5z" strokeWidth={1.8} />
  </Icon>
);

export const ItalicIcon = () => (
  <Icon>
    <path d="M8 3.5h5.5M4.5 14.5H10M10.75 3.5l-3.5 11" />
  </Icon>
);

export const BulletListIcon = () => (
  <Icon>
    <path d="M7 4.5h8M7 9h8M7 13.5h8" />
    <circle cx="3.5" cy="4.5" r="0.6" fill="currentColor" />
    <circle cx="3.5" cy="9" r="0.6" fill="currentColor" />
    <circle cx="3.5" cy="13.5" r="0.6" fill="currentColor" />
  </Icon>
);

export const NumberedListIcon = () => (
  <Icon>
    <path d="M7.5 4.5h7.5M7.5 9h7.5M7.5 13.5h7.5" />
    <path d="M2.75 3.5l1-.75V6M2.5 11.75c.3-.6 1.6-.7 1.6.2 0 .7-1.6 1.3-1.6 2.3h1.75" strokeWidth={1.2} />
  </Icon>
);

export const QuoteIcon = () => (
  <Icon>
    <path d="M3.5 3.5v11M7 5h7.5M7 9h7.5M7 13h4.5" />
  </Icon>
);

export const CodeIcon = () => (
  <Icon>
    <path d="M6 5L2.5 9 6 13M12 5l3.5 4-3.5 4M10.25 3.5l-2.5 11" />
  </Icon>
);

export const LinkIcon = () => (
  <Icon>
    <path d="M7.5 10.5a3 3 0 004.24 0l2.5-2.5a3 3 0 00-4.24-4.24l-.75.75" />
    <path d="M10.5 7.5a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 004.24 4.24l.75-.75" />
  </Icon>
);

export const UnlinkIcon = () => (
  <Icon>
    <path d="M4.5 4.5l9 9" />
    <path d="M10.75 5.25l.75-.75a3 3 0 014.24 4.24l-1.5 1.5M7.25 12.75l-.75.75a3 3 0 01-4.24-4.24l1.5-1.5" />
  </Icon>
);

export const OpenIcon = () => (
  <Icon>
    <path d="M10.5 3.5h4v4M14.5 3.5L8.5 9.5M12.5 10.5v4h-9v-9h4" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M9 3.5v11M3.5 9h11" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="4.75" />
    <path d="M11.5 11.5l3.5 3.5" />
  </Icon>
);
