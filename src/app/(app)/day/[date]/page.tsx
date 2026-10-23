import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayNav } from "@/features/day/day-nav";
import { DayView } from "@/features/day/day-view";
import { dayTitle, readDayQuery } from "@/features/day/nav";
import { getDay, getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { filterDay } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { TagColorsProvider } from "@/features/tags/tag-colors";
import { parseLocalDate } from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/day/[date]">): Promise<Metadata> {
  const date = parseLocalDate((await params).date);
  if (!date) notFound();
  return { title: dayTitle(date) };
}

export default async function DayPage({ params, searchParams }: PageProps<"/day/[date]">) {
  const date = parseLocalDate((await params).date);
  if (!date) notFound();
  const { mode, itemId } = readDayQuery(await searchParams);
  const [data, today, filter] = await Promise.all([getDay(date), getTodayDate(), getFilter(searchParams, true)]);
  return (
    <TagColorsProvider value={data.tagColors}>
      <DayView
        data={filterDay(data, filter)}
        filter={filter}
        mode={mode}
        nav={<DayNav date={date} today={today} mode={mode} />}
        detail={<DetailPanel itemId={itemId} />}
      />
    </TagColorsProvider>
  );
}
