import type { Metadata } from "next";
import { weekCalendar } from "@/features/calendar/load";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { weekOf, weekTitle } from "@/features/week/model";
import { getWeek } from "@/features/week/server";
import { WeekView } from "@/features/week/week-view";
import { filterWeek } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { TagColorsProvider } from "@/features/tags/tag-colors";
import { getItemsRepo } from "@/lib/items";

export async function generateMetadata(): Promise<Metadata> {
  return { title: weekTitle(weekOf(await getTodayDate())) };
}

export default async function ThisWeekPage({ searchParams }: PageProps<"/week">) {
  const today = await getTodayDate();
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter, repo] = await Promise.all([getWeek(today), getFilter(searchParams, true), getItemsRepo()]);
  const calendar = await weekCalendar(repo, filterWeek(data, filter));
  return (
    <TagColorsProvider value={data.tagColors}>
      <WeekView calendar={calendar} days={data.days} from={today} weekFull={data.weekFull} filter={filter} detail={<DetailPanel itemId={itemId} />} />
    </TagColorsProvider>
  );
}
