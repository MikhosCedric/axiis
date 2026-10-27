import type { Metadata } from "next";
import { parseQuery, searchItems } from "@/features/notes/commands";
import { SearchView } from "@/features/notes/search-view";
import { getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const query = parseQuery((await searchParams).q);
  const rows = query ? await searchItems(await getNotesRepo(), await getItemsRepo(), query, await getTimeZone()) : [];
  return <SearchView query={query ?? ""} rows={rows} />;
}
