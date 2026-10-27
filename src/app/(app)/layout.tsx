import type { ReactNode } from "react";
import { NavRail } from "@/components/shell/nav-rail";
import { PageTransition } from "@/components/shell/page-transition";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { undoDeletionAction } from "@/features/account/actions";
import { DeletionBanner } from "@/features/account/deletion-banner";
import { getDeletionDay } from "@/features/account/deletion-day";
import { getRailAreas, getTodayDate } from "@/features/day/server";
import { QuickIconSprite } from "@/features/actions/icon-sprite";
import { QuickActionsProvider } from "@/features/actions/provider";
import { PaletteProvider } from "@/features/palette/palette";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [today, areas, deletesOn] = await Promise.all([getTodayDate(), getRailAreas(), getDeletionDay()]);

  return (
    <PaletteProvider today={today} areas={areas}>
      <QuickActionsProvider today={today} areas={areas}>
      <div className="min-h-dvh rail:grid rail:grid-cols-[216px_minmax(0,1fr)]">
        <NavRail today={today} areas={areas} />
        {/* On a phone the places bar is fixed to the bottom, so the page ends above it. */}
        <main id="main" className="min-w-0 overflow-x-clip max-rail:pb-[calc(4rem+env(safe-area-inset-bottom))]">
          {deletesOn && <DeletionBanner deletesOn={deletesOn} undo={undoDeletionAction} />}
          <PageTransition>{children}</PageTransition>
        </main>
        <TimeZoneSync />
        <QuickIconSprite />
      </div>
      </QuickActionsProvider>
    </PaletteProvider>
  );
}
