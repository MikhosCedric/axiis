import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TagIndexHarness } from "./harness";

export const metadata: Metadata = { title: "Tags harness" };

/** Dev only: the tags index over in-memory fixtures, for checking it without a session. */
export default function TagsHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TagIndexHarness />;
}
