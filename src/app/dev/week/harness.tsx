"use client";

import { PaletteProvider } from "@/features/palette/palette";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import type { Area, Item } from "@/domain/item";
import { selectedIn } from "@/domain/item-key";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { captureTask, setDone, type ActionResult } from "@/features/today/commands";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { WEEK_TAGS } from "./fixture";
import { moveItem } from "@/features/week/commands";
import { loadWeek, type WeekData } from "@/features/week/load";
import { WeekNav } from "@/features/week/week-nav";
import { WeekView, type WeekActions } from "@/features/week/week-view";
import type { ItemsRepo } from "@/lib/items/repo";

const LATENCY_MS = 350;
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export function WeekHarness({ items, areas, initial }: { items: Item[]; areas: Area[]; initial: WeekData }) {
  const [fake] = useState(() => tagByTitle(fakeRepo(structuredClone(items), areas), WEEK_TAGS));
  const [data, setData] = useState(initial);
  const [failing, setFailing] = useState(false);
  const selected = useSearchParams().get(SELECTED_ITEM_PARAM);

  async function run(command: (repo: ItemsRepo) => Promise<ActionResult>): Promise<ActionResult> {
    await wait();
    const fail = async (): Promise<never> => {
      throw new Error("harness: saves are set to fail");
    };
    const result = await command(failing ? { ...fake.repo, update: fail, create: fail } : fake.repo);
    if (result.ok) {
      const next = structuredClone(await loadWeek(fake.repo, data.days[0], new Date(data.nowIso), data.timeZone));
      startTransition(() => setData(next));
    }
    return result;
  }

  const actions: WeekActions = {
    move: (id, to) => run((repo) => moveItem(repo, id, to, data.timeZone)),
    setDone: (id, done) => run((repo) => setDone(repo, id, done, data.timeZone)),
    capture: (title) => run((repo) => captureTask(repo, title, new Date(data.nowIso), data.timeZone)),
  };

  const shown = [...data.scheduled, ...data.unscheduled];
  const item = shown.find((i) => i.id === selectedIn(shown, selected));

  return (
    // The provider gives the Guide button its dialog, as the app layout does.
    <PaletteProvider today={data.today}>
      <div className="flex flex-wrap items-center gap-4 border-b border-rule bg-paper-2 px-4 py-2 text-[13px] text-ink-2">
        <span>Week harness with fixture data in {data.timeZone}. Saves stay in this tab; the week links leave it.</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make saves fail
        </label>
      </div>
      <WeekView
        data={data}
        actions={actions}
        nav={<WeekNav days={data.days} today={data.today} />}
        detail={
          item ? (
            <div>
              <p className="text-[13px] text-ink-3">Detail slot</p>
              <h2 className="mt-2 font-serif text-2xl font-medium text-balance">{item.title}</h2>
              <p className="mt-2 text-ink-2">
                {item.schedule.kind}, {item.recurrence.kind}
              </p>
            </div>
          ) : null
        }
      />
    </PaletteProvider>
  );
}
