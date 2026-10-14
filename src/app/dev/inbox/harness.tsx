"use client";

import { PaletteProvider } from "@/features/palette/palette";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import type { Area, Item } from "@/domain/item";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { loadInbox, planItem } from "@/features/inbox/commands";
import { InboxView, type InboxActions } from "@/features/inbox/inbox-view";
import type { InboxData } from "@/features/inbox/model";
import { captureTask, setDone, type ActionResult } from "@/features/today/commands";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { INBOX_TAGS } from "./fixture";
import type { ItemsRepo } from "@/lib/items/repo";

const LATENCY_MS = 350;
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export function InboxHarness({ items, areas, initial }: { items: Item[]; areas: Area[]; initial: InboxData }) {
  const [fake] = useState(() => tagByTitle(fakeRepo(structuredClone(items), areas), INBOX_TAGS));
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
      const next = structuredClone(await loadInbox(fake.repo, new Date(), data.timeZone));
      startTransition(() => setData(next));
    }
    return result;
  }

  const actions: InboxActions = {
    setDone: (id, done) => run((repo) => setDone(repo, id, done, data.timeZone)),
    plan: (id, when) => run((repo) => planItem(repo, id, when, new Date(), data.timeZone)),
    capture: (title) => run((repo) => captureTask(repo, title, new Date(), data.timeZone)),
  };

  const item = fake.items.find((i) => i.id === selected);

  return (
    // The provider gives the Guide button its dialog, as the app layout does.
    <PaletteProvider today={data.today}>
      <div className="flex flex-wrap items-center gap-4 border-b border-rule bg-paper-2 px-4 py-2 text-[13px] text-ink-2">
        <span>Inbox harness with fixture data in {data.timeZone}. Saves stay in this tab.</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make saves fail
        </label>
      </div>
      <InboxView
        data={data}
        actions={actions}
        detail={
          item ? (
            <div>
              <p className="text-[13px] text-ink-3">Detail slot</p>
              <h2 className="mt-2 font-serif text-2xl font-medium text-balance">{item.title}</h2>
              <p className="mt-2 text-ink-2">
                {item.type}, {item.schedule.kind}, {item.status}
              </p>
            </div>
          ) : null
        }
      />
    </PaletteProvider>
  );
}
