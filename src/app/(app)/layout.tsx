import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { DESKTOP_COOKIE, RAIL_COOKIE, readRailMin, readReminders, REMINDERS_COOKIE } from "@/components/shell/cookies";
import { NavRail } from "@/components/shell/nav-rail";
import { DesktopRefresh } from "@/components/shell/desktop-refresh";
import { OfflineNotice, ServiceWorkerRegistration } from "@/components/shell/offline";
import { OutboxProvider, PendingCaptures } from "@/components/shell/outbox";
import { PageTransition } from "@/components/shell/page-transition";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { undoDeletionAction } from "@/features/account/actions";
import { DeletionBanner } from "@/features/account/deletion-banner";
import { getDeletionDay } from "@/features/account/deletion-day";
import { getRailAreas, getRailBadges, getReminders, getTodayDate, getTrayRows } from "@/features/day/server";
import { QuickIconSprite } from "@/features/actions/icon-sprite";
import { QuickActionsProvider } from "@/features/actions/provider";
import { PaletteProvider } from "@/features/palette/palette";
import { getOutboxOwner } from "@/lib/account";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const min = readRailMin(jar.get(RAIL_COOKIE)?.value);
  // The desktop shell marks its pages with this cookie; only it shows a tray list, so the web pays nothing for one.
  const desktop = jar.get(DESKTOP_COOKIE)?.value === "1";
  // Settings can turn reminders off; the shell then simply finds none to speak.
  const remind = desktop && readReminders(jar.get(REMINDERS_COOKIE)?.value);
  const [today, areas, deletesOn, badges, owner, tray, reminders] = await Promise.all([
    getTodayDate(),
    getRailAreas(),
    getDeletionDay(),
    getRailBadges(),
    getOutboxOwner(),
    desktop ? getTrayRows() : Promise.resolve([]),
    remind ? getReminders() : Promise.resolve([]),
  ]);

  return (
    <OutboxProvider owner={owner}>
    <PaletteProvider today={today} areas={areas}>
      <QuickActionsProvider today={today} areas={areas}>
      <div
        id="app-shell"
        // The desktop shell reads these for the taskbar badge, the tray list and the reminders; nothing else uses them.
        data-inbox={badges.inbox}
        data-overdue={badges.overdue}
        data-tray={tray.length > 0 ? JSON.stringify(tray) : undefined}
        data-reminders={reminders.length > 0 ? JSON.stringify(reminders) : undefined}
        style={{ "--rail-w": min ? "64px" : "216px" } as React.CSSProperties}
        className="min-h-dvh rail:grid rail:grid-cols-[var(--rail-w,216px)_minmax(0,1fr)] motion-safe:rail:transition-[grid-template-columns] motion-safe:rail:duration-200"
      >
        <NavRail today={today} areas={areas} badges={badges} min={min} />
        {/* On a phone the places bar is fixed to the bottom, so the page ends above it. */}
        <main id="main" className="ground min-w-0 overflow-x-clip max-rail:pb-[calc(4rem+env(safe-area-inset-bottom))]">
          {deletesOn && <DeletionBanner deletesOn={deletesOn} undo={undoDeletionAction} />}
          <OfflineNotice />
          <PendingCaptures />
          <PageTransition>{children}</PageTransition>
        </main>
        <TimeZoneSync />
        <ServiceWorkerRegistration />
        {desktop && <DesktopRefresh />}
        <QuickIconSprite />
      </div>
      </QuickActionsProvider>
    </PaletteProvider>
    </OutboxProvider>
  );
}
