import type { Metadata } from "next";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { formatMonthHeading, monthOf } from "@/features/month/model";
import { MonthNav } from "@/features/month/month-nav";
import { MonthView } from "@/features/month/month-view";
import { getMonth } from "@/features/month/server";
import { getFilter } from "@/features/filter/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: formatMonthHeading(monthOf(await getTodayDate())) };
}

export default async function ThisMonthPage({ searchParams }: PageProps<"/month">) {
  const today = await getTodayDate();
  const { itemId } = readDayQuery(await searchParams);
  const filter = await getFilter(searchParams, false);
  const data = await getMonth(monthOf(today), filter);
  return <MonthView data={data} filter={filter} nav={<MonthNav month={data.month} today={today} />} detail={<DetailPanel itemId={itemId} />} />;
}
