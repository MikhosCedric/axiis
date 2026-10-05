import type { ReactNode } from "react";
import type { DayData, DayViewMode } from "./types";

/** Owned by the Score workstream. `nav` and `detail` are slots filled by the routing and detail workstreams. */
export function DayView({ data, nav, detail }: { data: DayData; mode: DayViewMode; nav?: ReactNode; detail?: ReactNode }) {
  return (
    <div className="px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      {nav}
      <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium">{data.date}</h1>
      {detail}
    </div>
  );
}
