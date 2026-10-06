import type { ReactNode } from "react";

/**
 * The column the detail panel sits in. While another item is on its way in,
 * the one still showing is inert, so a click meant for the next item can never
 * land on it.
 */
export function DetailAside({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <aside
      aria-label="Details"
      aria-busy={pending}
      className="border-t border-rule bg-sheet min-[1180px]:border-t-0 min-[1180px]:border-l"
    >
      <div className="px-4 py-6 rail:px-9 min-[1180px]:sticky min-[1180px]:top-0 min-[1180px]:max-h-dvh min-[1180px]:overflow-y-auto min-[1180px]:px-6 min-[1180px]:py-8">
        {/* The fade waits a beat, so a quick switch does not flicker. */}
        <div inert={pending} className={pending ? "opacity-40 transition-opacity delay-150 duration-200" : undefined}>
          {children}
        </div>
      </div>
    </aside>
  );
}
