import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { weekOf, weekTitle } from "@/features/week/model";
import { getWeek } from "@/features/week/server";
import { WeekNav } from "@/features/week/week-nav";
import { WeekView } from "@/features/week/week-view";
import { filterWeek } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { TagColorsProvider } from "@/features/tags/tag-colors";

export async function generateMetadata(): Promise<Metadata> {
  return { title: weekTitle(weekOf(await getTodayDate())) };
}

export default async function ThisWeekPage({ searchParams }: PageProps<"/week">) {
  const today = await getTodayDate();
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter] = await Promise.all([getWeek(today), getFilter(searchParams, true)]);
  return (
    <TagColorsProvider value={data.tagColors}>
      <WeekView data={filterWeek(data, filter)} filter={filter} nav={<WeekNav days={data.days} today={today} />} detail={<DetailPanel itemId={itemId} />} />
    </TagColorsProvider>
  );
}
