import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { readDayQuery } from "@/features/day/nav";
import { getTimeZone } from "@/features/day/server";
import { DetailPanel } from "@/features/detail/detail-panel";
import { loadTagged } from "@/features/tags/commands";
import { tagFromSegment, TAGS_PATH } from "@/features/tags/model";
import { TaggedView } from "@/features/tags/tagged-view";
import { getItemsRepo } from "@/lib/items";

const load = cache(async (segment: string) => loadTagged(await getItemsRepo(), tagFromSegment(segment), await getTimeZone()));

export async function generateMetadata({ params }: PageProps<"/tags/[name]">): Promise<Metadata> {
  const data = await load((await params).name);
  return { title: data ? `#${data.tag.name}` : "Tags" };
}

export default async function TagPage({ params, searchParams }: PageProps<"/tags/[name]">) {
  const [{ name }, query] = await Promise.all([params, searchParams]);
  const data = await load(name);
  if (!data) {
    return (
      <div className="mx-auto max-w-[760px] px-4 pt-8 rail:px-9">
        <p className="text-ink-2">No tag is called {tagFromSegment(name)}.</p>
        <Link href={TAGS_PATH} className="mt-3 inline-block rounded-md font-medium underline decoration-accent underline-offset-3">
          All tags
        </Link>
      </div>
    );
  }
  return <TaggedView data={data} detail={<DetailPanel itemId={readDayQuery(query).itemId} />} />;
}
