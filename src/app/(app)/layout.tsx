import type { ReactNode } from "react";
import { NavRail } from "@/components/shell/nav-rail";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { openByArea } from "@/features/today/model";
import { getToday } from "@/features/today/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { areas, view } = await getToday();
  const open = openByArea(view);

  return (
    <div className="min-h-dvh rail:grid rail:grid-cols-[216px_minmax(0,1fr)]">
      <NavRail areas={areas.map((a) => ({ id: a.id, name: a.name, open: open.get(a.id) ?? 0 }))} />
      <main className="min-w-0">{children}</main>
      <TimeZoneSync />
    </div>
  );
}
