import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDayQuery } from "@/features/day/nav";
import { tagFromSegment } from "@/features/tags/model";
import { TaggedHarness } from "../harness";

export const metadata: Metadata = { title: "Tag harness" };

/** Dev only: one tag's page over in-memory fixtures. Reads its segment the way `/tags/[name]` does. */
export default async function TagHarnessPage({ params, searchParams }: PageProps<"/dev/tags/[name]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const [{ name }, query] = await Promise.all([params, searchParams]);
  return <TaggedHarness name={tagFromSegment(name)} itemId={readDayQuery(query).itemId} />;
}
