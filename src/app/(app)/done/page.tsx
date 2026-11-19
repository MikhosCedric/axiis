import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getNow, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadDone } from "@/features/done/commands";
import { DoneView } from "@/features/done/done-view";
import { DONE_PAGE_PARAM, readPages } from "@/features/done/model";
import { getFilter } from "@/features/filter/server";
import { keeps } from "@/features/filter/model";
import { TagColorsProvider } from "@/features/tags/tag-colors";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Done" };

export default async function DonePage({ searchParams }: PageProps<"/done">) {
  const query = await searchParams;
  const { itemId } = readDayQuery(query);
  const pages = readPages(query[DONE_PAGE_PARAM]);
  const [{ tagColors, ...data }, filter] = await Promise.all([
    getItemsRepo().then(async (repo) => loadDone(repo, await getNow(), await getTimeZone(), pages)),
    getFilter(searchParams, true),
  ]);
  const rows = data.rows.filter((r) => keeps(filter, r, r.tags));
  return (
    <TagColorsProvider value={tagColors}>
      <DoneView data={{ ...data, rows }} filter={filter} detail={<DetailPanel itemId={itemId} />} />
    </TagColorsProvider>
  );
}
