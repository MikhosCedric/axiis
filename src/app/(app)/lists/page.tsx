import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadLists } from "@/features/lists/commands";
import { ListsView } from "@/features/lists/lists-view";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const { itemId } = readDayQuery(await searchParams);
  const data = await loadLists(await getItemsRepo(), await getTimeZone());
  return <ListsView data={data} detail={<DetailPanel itemId={itemId} />} />;
}
