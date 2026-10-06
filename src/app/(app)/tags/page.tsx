import type { Metadata } from "next";
import { loadTagIndex } from "@/features/tags/commands";
import { TagIndexView } from "@/features/tags/tag-index-view";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  return <TagIndexView tags={await loadTagIndex(await getItemsRepo())} />;
}
