import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getNow, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadDue } from "@/features/due/commands";
import { DueView } from "@/features/due/due-view";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Due" };

export default async function DuePage({ searchParams }: PageProps<"/due">) {
  const { itemId } = readDayQuery(await searchParams);
  const data = await loadDue(await getItemsRepo(), getNow(), await getTimeZone());
  return <DueView data={data} detail={<DetailPanel itemId={itemId} />} />;
}
