import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getNow, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadInbox } from "@/features/inbox/commands";
import { InboxView } from "@/features/inbox/inbox-view";
import { filterInbox } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { TagColorsProvider } from "@/features/tags/tag-colors";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter] = await Promise.all([
    getItemsRepo().then(async (repo) => loadInbox(repo, getNow(), await getTimeZone())),
    getFilter(searchParams, true),
  ]);
  return (
    <TagColorsProvider value={data.tagColors}>
      <InboxView data={filterInbox(data, filter)} filter={filter} detail={<DetailPanel itemId={itemId} />} />
    </TagColorsProvider>
  );
}
