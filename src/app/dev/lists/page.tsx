import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDayQuery } from "@/features/day/nav";
import { ListsHarness } from "./harness";

export const metadata: Metadata = { title: "Lists harness" };

/** Dev only: the Lists page over in-memory fixtures. `?empty` starts with no checklists. */
export default async function ListsHarnessPage({ searchParams }: PageProps<"/dev/lists">) {
  if (!devHarnessEnabled()) notFound();
  const query = await searchParams;
  return <ListsHarness empty={query.empty !== undefined} itemId={readDayQuery(query).itemId} />;
}
