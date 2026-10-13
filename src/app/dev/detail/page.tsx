import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { resolveTimeZone } from "@/lib/dates";
import { DetailHarness } from "./harness";

export const metadata: Metadata = { title: "Detail panel harness" };

/** Dev only: the detail sheet with fixture items and in-memory saves, for checking it without a session. */
export default async function DetailHarnessPage({ searchParams }: PageProps<"/dev/detail">) {
  if (!devHarnessEnabled()) notFound();
  const selected = (await searchParams)[SELECTED_ITEM_PARAM];
  const timeZone = resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  return <DetailHarness itemId={typeof selected === "string" ? selected : null} timeZone={timeZone} />;
}
