import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getClock, getNow, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadDue } from "@/features/due/commands";
import { DueView } from "@/features/due/due-view";
import { filterRows } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Due" };

export default async function DuePage({ searchParams }: PageProps<"/due">) {
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter] = await Promise.all([
    getItemsRepo().then(async (repo) => loadDue(repo, getNow(), await getTimeZone(), await getClock())),
    getFilter(searchParams, false),
  ]);
  return <DueView data={{ ...data, rows: filterRows(data.rows, filter) }} filter={filter} detail={<DetailPanel itemId={itemId} />} />;
}
