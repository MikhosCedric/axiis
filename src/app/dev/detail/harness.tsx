"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { occurrenceKey, parseItemKey } from "@/domain/item-key";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { loadDetail } from "@/features/detail/commands";
import { DetailSheet, MissingItem } from "@/features/detail/detail-sheet";
import type { DetailActions, DetailView } from "@/features/detail/model";
import { createLinkedNote } from "@/features/notes/commands";
import { connectedRow } from "@/features/notes/model";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";
import type { LinkId } from "@/lib/notes/repo";
import { harnessDetailActions } from "../detail-actions";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const areaId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}` as AreaId;
const day = (s: string) => s as LocalDate;

const AREAS: Area[] = [
  { id: areaId(1), name: "Work", position: 0 },
  { id: areaId(2), name: "Home", position: 1 },
  { id: areaId(3), name: "Health", position: 2 },
];

function fixtures(): Item[] {
  const trip = makeItem({
    id: id(1),
    title: "Plan the Lisbon trip",
    areaId: areaId(2),
    schedule: { kind: "day", on: day("2026-10-09") },
    dueOn: day("2026-10-12"),
  });
  const packing = makeItem({ id: id(10), type: "checklist", title: "Packing" });
  return [
    trip,
    makeItem({ id: id(2), title: "Book flights", parentId: trip.id, areaId: areaId(2), status: "done" }),
    makeItem({ id: id(3), title: "Find a place near Alfama", parentId: trip.id, areaId: areaId(2), status: "done" }),
    makeItem({ id: id(4), title: "Renew travel insurance", parentId: trip.id, areaId: areaId(2) }),
    makeItem({ id: id(5), title: "Check ferry times to Cacilhas", parentId: trip.id, areaId: areaId(2) }),
    packing,
    makeItem({ id: id(11), title: "Passport", parentId: packing.id, status: "done" }),
    makeItem({ id: id(12), title: "Phone charger", parentId: packing.id }),
    makeItem({ id: id(20), type: "note", title: "Ideas for the garden", areaId: areaId(2) }),
    makeItem({
      id: id(30),
      type: "event",
      title: "Dentist",
      areaId: areaId(3),
      schedule: { kind: "timed", start: new Date("2026-10-06T08:30:00Z"), end: new Date("2026-10-06T09:15:00Z") },
    }),
    makeItem({
      id: id(40),
      title:
        "Write the quarterly review and send the draft round before the Thursday planning session so there is time for comments",
      areaId: areaId(1),
      schedule: { kind: "timed", start: new Date("2026-10-06T14:00:00Z"), end: new Date("2026-10-06T17:30:00Z") },
    }),
    makeItem({ id: id(50), title: "An empty task with room for subtasks" }),
    makeItem({
      id: id(60),
      title: "Morning run",
      areaId: areaId(3),
      schedule: { kind: "timed", start: new Date("2026-10-05T06:30:00Z"), end: new Date("2026-10-05T07:15:00Z") },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: { kind: "never" } } },
    }),
    makeItem({
      id: id(61),
      title: "Morning run, slow",
      areaId: areaId(3),
      status: "done",
      completedAt: new Date("2026-10-07T07:20:00Z"),
      schedule: { kind: "timed", start: new Date("2026-10-07T06:30:00Z"), end: new Date("2026-10-07T07:15:00Z") },
      recurrence: { kind: "override", seriesId: id(60), originalOn: day("2026-10-07") },
    }),
    ...["2026-10-16", "2027-01-04"].map((on, n) =>
      makeItem({
        id: id(62 + n),
        title: "Morning run",
        areaId: areaId(3),
        status: "dropped",
        schedule: { kind: "timed", start: new Date(`${on}T06:30:00Z`), end: new Date(`${on}T07:15:00Z`) },
        recurrence: { kind: "override", seriesId: id(60), originalOn: day(on) },
      }),
    ),
    makeItem({
      id: id(70),
      title: "Water the plants",
      areaId: areaId(2),
      schedule: { kind: "day", on: day("2026-10-04") },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "count", count: 10 } } },
    }),
  ];
}

const FIXTURES: { id: string; label: string }[] = [
  { id: id(1), label: "Task with subtasks, some done" },
  { id: id(10), label: "Checklist, one subtask left" },
  { id: id(4), label: "A subtask" },
  { id: id(50), label: "Task with no subtasks" },
  { id: id(20), label: "Note" },
  { id: id(30), label: "Event" },
  { id: id(40), label: "Long title, runs past midnight in Manila" },
  { id: occurrenceKey(id(60), day("2026-10-09")), label: "Repeating: Friday's run, not touched yet" },
  { id: id(61), label: "Repeating: Wednesday's run, renamed and done" },
  { id: id(60), label: "Repeating: the run series itself, two days skipped" },
  { id: occurrenceKey(id(60), day("2027-01-04")), label: "Repeating: a skipped run in January" },
  { id: occurrenceKey(id(70), day("2026-10-11")), label: "Repeating: plants, weekly for ten weeks" },
  { id: occurrenceKey(id(60), day("2026-10-10")), label: "A Saturday the run does not happen" },
  { id: id(99), label: "An item that is gone" },
];

function createStore() {
  const items = fixtures();
  const fake = fakeRepo(items, AREAS);
  fake.tag(id(1), "travel", "Lisbon");
  fake.tag(id(60), "health");
  fake.tag(id(40), "Deep work");
  fake.tag(id(50), "errands");
  const notesStore: NotesStore = {
    items,
    bodyText: new Map(),
    links: [{ id: "10000000-0000-4000-8000-000000000001" as LinkId, fromId: id(20), toId: id(1) }],
  };
  return { items, repo: fake.repo, notesStore, notes: fakeNotesRepo(notesStore) };
}

function linkedNotesOf(store: NotesStore, itemId: ItemId) {
  return store.links.flatMap((l) => {
    if (l.fromId !== itemId && l.toId !== itemId) return [];
    const outgoing = l.fromId === itemId;
    const other = store.items.find((i) => i.id === (outgoing ? l.toId : l.fromId));
    return other?.type === "note" ? [connectedRow({ linkId: l.id, direction: outgoing ? "outgoing" : "incoming", item: other })] : [];
  });
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 450));

export function DetailHarness({ itemId, timeZone }: { itemId: string | null; timeZone: string }) {
  const [store] = useState(createStore);
  const [version, setVersion] = useState(0);
  const [failing, setFailing] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; view: DetailView | null } | null>(null);

  const actions: DetailActions = {
    ...harnessDetailActions(store.repo, timeZone, async (command) => {
      await pause();
      if (failing) return { ok: false, error: "That change did not save. Try again." };
      const result = await command();
      if (result.ok) setVersion((v) => v + 1);
      return result;
    }),
    newLinkedNote: async (itemId) => {
      await pause();
      if (failing) return { ok: false, error: "A new note could not be made. Try again." };
      return createLinkedNote(store.notes, store.repo, itemId);
    },
  };

  useEffect(() => {
    const key = parseItemKey(itemId);
    if (!key || !itemId) return;
    let live = true;
    loadDetail(store.repo, key, new Date(), timeZone).then((view) => {
      if (live) setLoaded({ key: itemId, view });
    });
    return () => {
      live = false;
    };
  }, [itemId, version, store, timeZone]);

  const current = loaded && loaded.key === itemId ? loaded : null;

  return (
    <div className="min-h-dvh rail:grid rail:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
      <main className="px-4 pt-6 pb-10 rail:px-9 rail:pt-8">
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">
          Detail panel
        </h1>
        <p className="mt-2.5 max-w-[60ch] text-[15px] text-ink-2">
          Fixture items in memory, saved through the real commands with a short delay. Times show in {timeZone}.
        </p>
        <ul className="mt-6 grid max-w-[440px] border-t border-rule">
          {FIXTURES.map((f) => (
            <li key={f.id} className="border-b border-rule-soft">
              <Link
                href={`?item=${f.id}`}
                aria-current={f.id === itemId ? "true" : undefined}
                className="block rounded-md px-2 py-2.5 hover:bg-accent-wash aria-[current]:font-semibold"
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
        <label className="mt-5 flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make every save fail
        </label>
      </main>
      {current && (
        <div className="border-t border-rule px-4 pt-5 pb-10 rail:border-t-0 rail:border-l rail:px-6 rail:pt-8">
          {current.view ? (
            <DetailSheet
              key={current.key}
              view={current.view}
              actions={actions}
              linkedNotes={linkedNotesOf(store.notesStore, current.view.notesFor)}
            />
          ) : (
            <MissingItem />
          )}
        </div>
      )}
    </div>
  );
}
