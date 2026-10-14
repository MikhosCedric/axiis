"use client";

import { PaletteProvider } from "@/features/palette/palette";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import type { Area, Item } from "@/domain/item";
import { selectedIn } from "@/domain/item-key";
import { DayView, type DayActions } from "@/features/day/day-view";
import { SELECTED_ITEM_PARAM, type DayData, type DayViewMode } from "@/features/day/types";
import { setTime } from "@/features/detail/commands";
import { placeItem } from "@/features/score/commands";
import { captureTask, setDone, type ActionResult } from "@/features/today/commands";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import type { ItemsRepo } from "@/lib/items/repo";
import { loadDayData, SCORE_TAGS } from "./fixture";

const LATENCY_MS = 350;
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export function ScoreHarness({
  items,
  areas,
  initial,
  mode,
}: {
  items: Item[];
  areas: Area[];
  initial: DayData;
  mode: DayViewMode;
}) {
  const [fake] = useState(() => tagByTitle(fakeRepo(structuredClone(items), areas), SCORE_TAGS));
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
      const next = structuredClone(await loadDayData(fake.repo, new Date(data.nowIso), data.timeZone));
      startTransition(() => setData(next));
    }
    return result;
  }

  const actions: DayActions = {
    place: (id, placement) => run((repo) => placeItem(repo, id, placement, data.timeZone)),
    setDone: (id, done) => run((repo) => setDone(repo, id, done, data.timeZone)),
    capture: (title) => run((repo) => captureTask(repo, title, new Date(data.nowIso), data.timeZone)),
    timeSeries: (id, time) => run((repo) => setTime(repo, id, time, data.timeZone, "all")),
  };

  const shown = [...data.view.scheduled, ...data.view.waiting].map((e) => e.item);
  const item = shown.find((i) => i.id === selectedIn(shown, selected));

  return (
    // The provider gives the Guide button its dialog, as the app layout does.
    <PaletteProvider today={data.date}>
      <div className="flex flex-wrap items-center gap-4 border-b border-rule bg-paper-2 px-4 py-2 text-[13px] text-ink-2">
        <span>Score harness with fixture data. Saves stay in this tab.</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make saves fail
        </label>
      </div>
      <DayView
        data={data}
        mode={mode}
        actions={actions}
        nav={<p className="text-[13px] text-ink-3">Date navigation slot</p>}
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
