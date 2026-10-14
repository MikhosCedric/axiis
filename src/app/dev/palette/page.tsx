import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTodayDate } from "@/features/day/server";
import { PaletteHarness } from "./harness";

export const metadata: Metadata = { title: "Palette harness" };

/** Dev only: the command palette and shortcuts list over in-memory fakes, for checking them without a session. */
export default async function PaletteHarnessPage({ searchParams }: PageProps<"/dev/palette">) {
  if (!devHarnessEnabled()) notFound();
  // `?nav=off` leaves the nav rail out, to look at the dialogs at phone width on their own.
  return <PaletteHarness today={await getTodayDate()} nav={(await searchParams).nav !== "off"} />;
}
