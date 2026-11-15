"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import { Segmented } from "@/components/segmented";
import type { Area, Item, LocalDate } from "@/domain/item";
import { selectedIn } from "@/domain/item-key";
import { duplicateItem, restoreItems, tagChoices } from "@/features/actions/commands";
import type { QuickActions } from "@/features/actions/context";
import { QuickActionsProvider } from "@/features/actions/provider";
import { CalendarView, type CalendarActions, type CalendarData } from "@/features/calendar/calendar-view";
import type { CalendarMode } from "@/features/calendar/grid-layout";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { clearTime, deleteItem, renameItem, restoreOccurrence, setItemArea, setTime, setType } from "@/features/detail/commands";
import { planItem } from "@/features/inbox/commands";
import { placeItem } from "@/features/score/commands";
import { addTag, removeTag } from "@/features/tags/commands";
import { captureTask, setDone } from "@/features/today/commands";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { moveItem } from "@/features/week/commands";
import type { ItemsRepo } from "@/lib/items/repo";
import { WEEK_TAGS } from "./week-fixture";
import { loadCalendar } from "./fixture";

const LATENCY_MS = 250;
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

const SPANS: { key: CalendarMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "3day", label: "3 days" },
  { key: "week", label: "Week" },
];

/** The days a span shows out of the week loaded: the day itself, three days from it (kept inside the week), or all seven. */
function daysFor(span: CalendarMode, week: LocalDate[], shown: LocalDate): LocalDate[] {
  const at = Math.max(0, week.indexOf(shown));
  if (span === "day") return [week[at]];
  if (span === "3day") return week.slice(Math.min(at, week.length - 3), Math.min(at, week.length - 3) + 3);
  return week;
}

export function CalendarHarness({
  items,
  areas,
  initial,
  week,
  shown,
  span: firstSpan,
  pinned,
}: {
  items: Item[];
  areas: Area[];
  initial: CalendarData;
  week: LocalDate[];
  shown: LocalDate;
  span: CalendarMode;
  pinned: boolean;
}) {
  const [fake] = useState(() => tagByTitle(fakeRepo(structuredClone(items), areas), WEEK_TAGS));
  const [data, setData] = useState(initial);
  const [span, setSpan] = useState(firstSpan);
  const [failing, setFailing] = useState(false);
  const [dim, setDim] = useState(false);
  const selected = useSearchParams().get(SELECTED_ITEM_PARAM);
  const tz = data.timeZone;
  const now = () => new Date(data.nowIso);

  async function run<T extends { ok: boolean }>(command: (repo: ItemsRepo) => Promise<T>): Promise<T> {
    await wait();
    const fail = async (): Promise<never> => {
      throw new Error("harness: saves are set to fail");
    };
    const result = await command(failing ? { ...fake.repo, update: fail, create: fail } : fake.repo);
    if (result.ok) {
      const next = structuredClone((await loadCalendar(fake.repo, shown, now(), tz)).data);
      startTransition(() => setData(next));
    }
    return result;
  }

  const actions: CalendarActions = {
    place: (id, placement) => run((repo) => placeItem(repo, id, placement, tz)),
    setDone: (id, done) => run((repo) => setDone(repo, id, done, tz)),
    capture: (text) => run((repo) => captureTask(repo, text, now(), tz)),
  };

  // The row actions (rename, plan, delete with Undo and the rest) through the same commands the app runs.
  const quick: QuickActions = {
    setDone: actions.setDone,
    rename: (key, title) => run((repo) => renameItem(repo, key, title, tz)),
    plan: (key, when) => run((repo) => planItem(repo, key, when, now(), tz)),
    unplan: (key) => run((repo) => moveItem(repo, key, "tray", tz)),
    setTime: (key, time) => run((repo) => setTime(repo, key, time, tz)),
    clearTime: (key) => run((repo) => clearTime(repo, key, tz)),
    setArea: (key, area) => run((repo) => setItemArea(repo, key, area, tz)),
    addTag: (key, name) => run((repo) => addTag(repo, key, name, tz)),
    removeTag: (key, name) => run((repo) => removeTag(repo, key, name, tz)),
    remove: (key, scope) => run((repo) => deleteItem(repo, key, tz, scope)),
    restore: (ids) => run((repo) => restoreItems(repo, ids)),
    unskip: (key) => run((repo) => restoreOccurrence(repo, key, tz)),
    duplicate: (key) => run((repo) => duplicateItem(repo, key, tz)),
    setType: (key, type) => run((repo) => setType(repo, key, type, tz)),
    tagChoices: (key) => tagChoices(fake.repo, key, tz),
  };

  const item = data.items.find((i) => i.id === selectedIn(data.items, selected));

  return (
    <QuickActionsProvider areas={data.areas} today={data.today} actions={quick}>
      <main id="main">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-paper-2 px-4 py-2 text-[13px] text-ink-2">
        <span>Calendar harness with fixture data in {tz}. Saves stay in this tab.</span>
        <Segmented label="Span" chosen={span} segments={SPANS} onChoose={(key) => setSpan(key as CalendarMode)} className="h-[34px] pointer-coarse:h-11" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={dim} onChange={(e) => setDim(e.target.checked)} />
          Focus
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make saves fail
        </label>
      </div>
      <div className="px-3 pt-4 pb-10 rail:px-8 rail:pt-6">
        <h1 className="headline mb-4">Calendar</h1>
        <CalendarView
          data={data}
          days={daysFor(span, week, shown)}
          mode={span}
          dim={dim}
          ticking={!pinned}
          actions={actions}
          detail={
            item ? (
              <div>
                <p className="text-[13px] text-ink-3">Detail slot</p>
                <h2 className="mt-2 font-display text-2xl font-medium text-balance">{item.title}</h2>
                <p className="mt-2 text-ink-2">
                  {item.schedule.kind}, {item.recurrence.kind}
                </p>
              </div>
            ) : null
          }
        />
      </div>
      </main>
    </QuickActionsProvider>
  );
}
