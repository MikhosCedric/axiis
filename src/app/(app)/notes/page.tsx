import type { Metadata } from "next";
import { listNoteRows, parseQuery } from "@/features/notes/commands";
import { NotesList } from "@/features/notes/notes-list";
import { notesActions, requestTimeZone } from "@/features/notes/server";
import { getClock } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const query = parseQuery((await searchParams).q);
  const [notes, items, timeZone] = await Promise.all([getNotesRepo(), getItemsRepo(), requestTimeZone()]);
  const rows = await listNoteRows(notes, items, query, new Date(), timeZone, await getClock());
  return <NotesList rows={rows} query={query ?? ""} create={notesActions.create} />;
}
