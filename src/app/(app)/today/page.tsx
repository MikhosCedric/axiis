import type { Metadata } from "next";
import { getToday } from "@/features/today/server";
import { TodayView } from "@/features/today/today-view";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  return <TodayView today={await getToday()} />;
}
