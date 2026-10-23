import type { Metadata } from "next";
import { listNoteRows, parseQuery } from "@/features/notes/commands";
import { NotesList } from "@/features/notes/notes-list";
import { notesActions, requestTimeZone } from "@/features/notes/server";
import { getClock } from "@/features/day/server";
import { filterRows } from "@/features/filter/apply";
import { getFilter } from "@/features/filter/server";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const query = parseQuery((await searchParams).q);
  const [notes, items, timeZone] = await Promise.all([getNotesRepo(), getItemsRepo(), requestTimeZone()]);
  const [rows, filter] = await Promise.all([
    getClock().then((clock) => listNoteRows(notes, items, query, new Date(), timeZone, clock)),
    getFilter(searchParams, false),
  ]);
  return <NotesList rows={filterRows(rows, filter)} filter={filter} query={query ?? ""} create={notesActions.create} />;
}
