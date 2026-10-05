"use client";

import Link from "next/link";
import { useState } from "react";
import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { setDone } from "@/features/today/commands";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { addSubtask, deleteItem, parseItemId, promoteSubtask, renameItem, setItemArea } from "@/features/detail/commands";
import { DetailSheet, MissingItem } from "@/features/detail/detail-sheet";
import { buildDetail, type DetailActions } from "@/features/detail/model";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const areaId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}` as AreaId;

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
    schedule: { kind: "day", on: "2026-10-09" as LocalDate },
    dueOn: "2026-10-12" as LocalDate,
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
  { id: id(99), label: "An item that is gone" },
];

function createStore() {
  const items = fixtures();
  const fake = fakeRepo(items, AREAS);
  fake.repo.softDelete = async (gone) => {
    const at = items.findIndex((i) => i.id === gone);
    if (at >= 0) items.splice(at, 1);
  };
  return { items, repo: fake.repo };
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 450));

export function DetailHarness({ itemId, timeZone }: { itemId: string | null; timeZone: string }) {
  const [store] = useState(createStore);
  const [, setVersion] = useState(0);
  const [failing, setFailing] = useState(false);

  function fake<A extends unknown[]>(command: (repo: typeof store.repo, ...args: A) => ReturnType<DetailActions["promote"]>) {
    return async (...args: A) => {
      await pause();
      if (failing) return { ok: false as const, error: "That change did not save. Try again." };
      const result = await command(store.repo, ...args);
      if (result.ok) setVersion((v) => v + 1);
      return result;
    };
  }

  const actions: DetailActions = {
    rename: fake(renameItem),
    setDone: fake(setDone),
    setArea: fake(setItemArea),
    addSubtask: fake(addSubtask),
    promote: fake(promoteSubtask),
    remove: fake(deleteItem),
  };

  const item = store.items.find((i) => i.id === itemId) ?? null;
  const view =
    item &&
    buildDetail({
      item,
      areas: AREAS,
      subtasks: store.items.filter((i) => i.parentId === item.id),
      parent: store.items.find((i) => i.id === item.parentId) ?? null,
      timeZone,
    });

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
      {parseItemId(itemId) && (
        <div className="border-t border-rule px-4 pt-5 pb-10 rail:border-t-0 rail:border-l rail:px-6 rail:pt-8">
          {view ? <DetailSheet key={view.item.id} view={view} actions={actions} /> : <MissingItem />}
        </div>
      )}
    </div>
  );
}
