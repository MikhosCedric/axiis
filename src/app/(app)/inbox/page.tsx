import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getNow, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadInbox } from "@/features/inbox/commands";
import { InboxView } from "@/features/inbox/inbox-view";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const { itemId } = readDayQuery(await searchParams);
  const data = await loadInbox(await getItemsRepo(), getNow(), await getTimeZone());
  return <InboxView data={data} detail={<DetailPanel itemId={itemId} />} />;
}
