import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { weekOf, weekTitle } from "@/features/week/model";
import { getWeek } from "@/features/week/server";
import { WeekNav } from "@/features/week/week-nav";
import { WeekView } from "@/features/week/week-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: weekTitle(weekOf(await getTodayDate())) };
}

export default async function ThisWeekPage({ searchParams }: PageProps<"/week">) {
  const today = await getTodayDate();
  const { itemId } = readDayQuery(await searchParams);
  const data = await getWeek(today);
  return <WeekView data={data} nav={<WeekNav days={data.days} today={today} />} detail={<DetailPanel itemId={itemId} />} />;
}
