import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { weekOf, weekTitle } from "@/features/week/model";
import { getWeek } from "@/features/week/server";
import { WeekNav } from "@/features/week/week-nav";
import { WeekView } from "@/features/week/week-view";
import { filterWeek } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
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
  const [data, today, filter] = await Promise.all([getWeek(date), getTodayDate(), getFilter(searchParams, true)]);
  return <WeekView data={filterWeek(data, filter)} filter={filter} nav={<WeekNav days={data.days} today={today} />} detail={<DetailPanel itemId={itemId} />} />;
}
