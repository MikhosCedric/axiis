import type { ReactNode } from "react";
import { NavRail } from "@/components/shell/nav-rail";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { getRailAreas, getTodayDate } from "@/features/day/server";
import { PaletteProvider } from "@/features/palette/palette";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [today, areas] = await Promise.all([getTodayDate(), getRailAreas()]);

  return (
    <PaletteProvider today={today}>
      <div className="min-h-dvh rail:grid rail:grid-cols-[216px_minmax(0,1fr)]">
        <NavRail today={today} areas={areas} />
        {/* On a phone the places bar is fixed to the bottom, so the page ends above it. */}
        <main id="main" className="min-w-0 max-rail:pb-[calc(4rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <TimeZoneSync />
      </div>
    </PaletteProvider>
  );
}
