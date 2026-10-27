// One family for the cluster and its menus: an 18 grid drawn at 16px on 1.5px strokes, as the
// detail panel's icons are. The drawings are sent once as server HTML (`QuickIconSprite`, in the app
// layout) and every button points at one with `<use>`, so no row carries them in its JavaScript.

const DRAWINGS = {
  done: <path d="M3.5 9.5l3.5 3.5 7.5-8" />,
  rename: (
    <>
      <path d="M11.5 3.5l3 3-8 8H3.5v-3z" />
      <path d="M9.5 5.5l3 3" />
    </>
  ),
  plan: (
    <>
      <rect x="2.75" y="3.75" width="12.5" height="11.5" rx="1.5" />
      <path d="M2.75 7.25h12.5M6 2.25v3M12 2.25v3" />
    </>
  ),
  labels: (
    <>
      <path d="M2.75 3.75v4.5l7 7 5.5-5.5-7-7h-4.5a1 1 0 0 0-1 1z" />
      <circle cx="6" cy="6.25" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  delete: <path d="M3 5h12M7 5V3h4v2M4.5 5l.8 10.5h7.4L13.5 5" />,
  more: (
    <>
      <circle cx="4" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  duplicate: (
    <>
      <rect x="6.25" y="6.25" width="9" height="9" rx="1.5" />
      <path d="M11.75 3.75v-.5a1 1 0 0 0-1-1h-7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h.5" />
    </>
  ),
  /** An event's beam, with the two ticks that close it. */
  event: <path d="M3 5.5v7M15 5.5v7M3 9h12" />,
  /** A task's round head on its beam. */
  task: (
    <>
      <circle cx="5" cy="9" r="2.5" />
      <path d="M7.5 9H15" />
    </>
  ),
  inbox: (
    <>
      <path d="M2.75 10.5l2-6.75h8.5l2 6.75v3.75a1 1 0 0 1-1 1H3.75a1 1 0 0 1-1-1z" />
      <path d="M2.75 10.5h3.5l1 1.75h3.5l1-1.75h3.5" />
    </>
  ),
  open: (
    <>
      <rect x="2.75" y="3.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M10.5 3.25v11.5" />
    </>
  ),
  /** Stepping over one occurrence, as the detail panel draws Skip this one. */
  skip: (
    <>
      <path d="M3 12.5c1.5-4.5 6.5-6 10-3" />
      <path d="M13.5 6.5v3.2h-3.2" />
      <path d="M4 15.5h2M12 15.5h2" />
    </>
  ),
};

export type QuickIconName = keyof typeof DRAWINGS;


/** Every drawing as a `<symbol>`, once per page, hidden. */
export function QuickIconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      {Object.entries(DRAWINGS).map(([name, drawing]) => (
        <symbol key={name} id={`qa-${name}`} viewBox="0 0 18 18">
          <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            {drawing}
          </g>
        </symbol>
      ))}
    </svg>
  );
}
