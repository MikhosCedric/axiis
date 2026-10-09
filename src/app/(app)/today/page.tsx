import type { Metadata } from "next";
import { DayNav } from "@/features/day/day-nav";
import { DayView } from "@/features/day/day-view";
import { readDayQuery } from "@/features/day/nav";
import { getDay, getTimeZone, getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadLeftover } from "@/features/day/leftover";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const today = await getTodayDate();
  const { mode, itemId } = readDayQuery(await searchParams);
  const [data, leftover] = await Promise.all([getDay(today), getItemsRepo().then(async (repo) => loadLeftover(repo, today, await getTimeZone()))]);
  return (
    <DayView
      data={data}
      leftover={leftover}
      mode={mode}
      nav={<DayNav date={today} today={today} mode={mode} />}
      detail={<DetailPanel itemId={itemId} />}
    />
  );
}
