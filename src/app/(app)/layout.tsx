import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RAIL_COOKIE, readRailMin } from "@/components/shell/cookies";
import { NavRail } from "@/components/shell/nav-rail";
import { PageTransition } from "@/components/shell/page-transition";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { undoDeletionAction } from "@/features/account/actions";
import { DeletionBanner } from "@/features/account/deletion-banner";
import { getDeletionDay } from "@/features/account/deletion-day";
import { getRailAreas, getRailBadges, getTodayDate } from "@/features/day/server";
import { QuickIconSprite } from "@/features/actions/icon-sprite";
import { QuickActionsProvider } from "@/features/actions/provider";
import { PaletteProvider } from "@/features/palette/palette";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const min = readRailMin((await cookies()).get(RAIL_COOKIE)?.value);
  const [today, areas, deletesOn, badges] = await Promise.all([getTodayDate(), getRailAreas(), getDeletionDay(), getRailBadges()]);

  return (
    <PaletteProvider today={today} areas={areas}>
      <QuickActionsProvider today={today} areas={areas}>
      <div
        id="app-shell"
        // The desktop shell reads these two numbers for the taskbar badge; nothing else uses them.
        data-inbox={badges.inbox}
        data-overdue={badges.overdue}
        style={{ "--rail-w": min ? "64px" : "216px" } as React.CSSProperties}
        className="min-h-dvh rail:grid rail:grid-cols-[var(--rail-w,216px)_minmax(0,1fr)] motion-safe:rail:transition-[grid-template-columns] motion-safe:rail:duration-200"
      >
        <NavRail today={today} areas={areas} badges={badges} min={min} />
        {/* On a phone the places bar is fixed to the bottom, so the page ends above it. */}
        <main id="main" className="ground min-w-0 overflow-x-clip max-rail:pb-[calc(4rem+env(safe-area-inset-bottom))]">
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
