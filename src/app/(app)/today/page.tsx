import type { Metadata } from "next";
import { DayNav } from "@/features/day/day-nav";
import { DayView } from "@/features/day/day-view";
import { readDayQuery } from "@/features/day/nav";
import { getDay, getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const today = await getTodayDate();
  const { mode, itemId } = readDayQuery(await searchParams);
  const data = await getDay(today);
  return (
    <DayView
      data={data}
      mode={mode}
      nav={<DayNav date={today} today={today} mode={mode} />}
      detail={<DetailPanel itemId={itemId} />}
    />
  );
}
