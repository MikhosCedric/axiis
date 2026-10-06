import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requestTimeZone } from "@/features/notes/server";
import { HarnessEditor } from "../harness";

export const metadata: Metadata = { title: "Note editor harness" };

/** Dev only: the note editor over in-memory fixtures. */
export default async function NoteHarnessPage({ params }: PageProps<"/dev/notes/[id]">) {
  if (process.env.NODE_ENV === "production") notFound();
  return <HarnessEditor noteId={(await params).id} timeZone={await requestTimeZone()} />;
}
