import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readDayQuery } from "@/features/day/nav";
import { getClock, getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { deleteTagAction, renameTagAction, setTagColorAction } from "@/features/tags/actions";
import { loadTagged } from "@/features/tags/commands";
import { tagFromSegment } from "@/features/tags/model";
import { TaggedView } from "@/features/tags/tagged-view";
import { getItemsRepo } from "@/lib/items";

const load = cache(async (segment: string) => loadTagged(await getItemsRepo(), tagFromSegment(segment), await getTimeZone(), await getClock()));

export async function generateMetadata({ params }: PageProps<"/tags/[name]">): Promise<Metadata> {
  const data = await load((await params).name);
  return { title: data ? `#${data.tag.name}` : "No such tag" };
}

export default async function TagPage({ params, searchParams }: PageProps<"/tags/[name]">) {
  const [{ name }, query] = await Promise.all([params, searchParams]);
  const data = await load(name);
  // A tag that is gone (deleted, or renamed from an old link) is a missing page: not-found.tsx beside this says so.
  if (!data) notFound();
  return <TaggedView
      data={data}
      actions={{ rename: renameTagAction, remove: deleteTagAction, color: setTagColorAction }}
      detail={<DetailPanel itemId={readDayQuery(query).itemId} />}
    />;
}
