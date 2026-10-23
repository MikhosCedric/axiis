import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getClock, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadLists } from "@/features/lists/commands";
import { ListsView } from "@/features/lists/lists-view";
import { filterRows } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter] = await Promise.all([
    getItemsRepo().then(async (repo) => loadLists(repo, await getTimeZone(), await getClock())),
    getFilter(searchParams, false),
  ]);
  return <ListsView data={{ ...data, rows: filterRows(data.rows, filter) }} filter={filter} detail={<DetailPanel itemId={itemId} />} />;
}
