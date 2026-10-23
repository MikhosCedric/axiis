import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDayQuery } from "@/features/day/nav";
import { getTodayDate } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { formatMonthHeading, parseYearMonth } from "@/features/month/model";
import { MonthNav } from "@/features/month/month-nav";
import { MonthView } from "@/features/month/month-view";
import { getMonth } from "@/features/month/server";
import { getFilter } from "@/features/filter/server";

export async function generateMetadata({ params }: PageProps<"/month/[ym]">): Promise<Metadata> {
  const month = parseYearMonth((await params).ym);
  if (!month) notFound();
  return { title: formatMonthHeading(month) };
}

export default async function MonthPage({ params, searchParams }: PageProps<"/month/[ym]">) {
  const month = parseYearMonth((await params).ym);
  if (!month) notFound();
  const { itemId } = readDayQuery(await searchParams);
  const filter = await getFilter(searchParams, false);
  const [data, today] = await Promise.all([getMonth(month, filter), getTodayDate()]);
  return <MonthView data={data} filter={filter} nav={<MonthNav month={data.month} today={today} />} detail={<DetailPanel itemId={itemId} />} />;
}
