import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { weekCalendar } from "@/features/calendar/load";
import { readDayQuery } from "@/features/day/nav";
import { DetailPanel } from "@/features/detail/detail-panel";
import { weekOf, weekTitle } from "@/features/week/model";
import { getWeek } from "@/features/week/server";
import { WeekView } from "@/features/week/week-view";
import { filterWeek } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { TagColorsProvider } from "@/features/tags/tag-colors";
import { getItemsRepo } from "@/lib/items";
import { getLeftover } from "@/features/day/leftover-server";
import { getTodayDate } from "@/features/day/server";
import { parseLocalDate } from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/week/[date]">): Promise<Metadata> {
  const date = parseLocalDate((await params).date);
  if (!date) notFound();
  return { title: weekTitle(weekOf(date)) };
}

export default async function WeekPage({ params, searchParams }: PageProps<"/week/[date]">) {
  const date = parseLocalDate((await params).date);
  if (!date) notFound();
  const { itemId } = readDayQuery(await searchParams);
  const [data, filter, repo, today] = await Promise.all([getWeek(date), getFilter(searchParams, true), getItemsRepo(), getTodayDate()]);
  const leftover = await getLeftover(today, filter);
  const calendar = await weekCalendar(repo, filterWeek(data, filter));
  return (
    <TagColorsProvider value={data.tagColors}>
      <WeekView calendar={calendar} days={data.days} from={date} weekFull={data.weekFull} leftover={leftover} filter={filter} detail={<DetailPanel itemId={itemId} />} />
    </TagColorsProvider>
  );
}
