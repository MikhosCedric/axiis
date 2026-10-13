import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { loadNote } from "@/features/notes/commands";
import { displayTitle } from "@/features/notes/model";
import { NoteEditor } from "@/features/notes/note-editor";
import { notesActions, requestTimeZone } from "@/features/notes/server";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";

const load = cache(async (rawId: string) => {
  const [notes, items, timeZone] = await Promise.all([getNotesRepo(), getItemsRepo(), requestTimeZone()]);
  return loadNote(notes, items, rawId, new Date(), timeZone);
});

export async function generateMetadata({ params }: PageProps<"/notes/[id]">): Promise<Metadata> {
  const view = await load((await params).id);
  return { title: view ? displayTitle({ type: "note", title: view.note.title }) : "Notes" };
}

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const view = await load((await params).id);
  if (!view) {
    return (
      <div className="mx-auto max-w-[760px] px-4 pt-8 rail:px-9">
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">Notes</h1>
        <p className="mt-4 text-ink-2">That note is not here any more.</p>
        <Link href="/notes" className="mt-3 inline-block rounded-md font-medium underline decoration-accent underline-offset-3">
          Back to notes
        </Link>
      </div>
    );
  }
  return <NoteEditor key={view.note.id} view={view} actions={notesActions} />;
}
