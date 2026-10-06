import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requestTimeZone } from "@/features/notes/server";
import { HarnessList } from "./harness";

export const metadata: Metadata = { title: "Notes harness" };

/** Dev only: the notes list over in-memory fixtures, for checking it without a session. */
export default async function NotesHarnessPage({ searchParams }: PageProps<"/dev/notes">) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = (await searchParams).q;
  return <HarnessList query={typeof q === "string" ? q : ""} timeZone={await requestTimeZone()} />;
}
