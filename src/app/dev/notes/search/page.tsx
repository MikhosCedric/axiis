import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HarnessSearch } from "../harness";

export const metadata: Metadata = { title: "Search harness" };

/** Dev only: the search page over in-memory fixtures. */
export default async function SearchHarnessPage({ searchParams }: PageProps<"/dev/notes/search">) {
  if (!devHarnessEnabled()) notFound();
  const q = (await searchParams).q;
  return <HarnessSearch query={typeof q === "string" ? q.trim() : ""} />;
}
