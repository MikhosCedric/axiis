"use client";

import { useEffect, useState } from "react";
import { parseItemKey } from "@/domain/item-key";
import { loadDetail } from "@/features/detail/commands";
import { DetailSheet, MissingItem } from "@/features/detail/detail-sheet";
import type { DetailActions, DetailView } from "@/features/detail/model";
import { loadLists } from "@/features/lists/commands";
import { ListsView } from "@/features/lists/lists-view";
import type { ListsData } from "@/features/lists/model";
import {
  captureChecklist,
  setDone as setDoneCommand,
  type ActionResult,
  type CaptureResult,
} from "@/features/today/commands";
import { harnessDetailActions } from "../detail-actions";
import { settings, stores } from "./store";

const TZ = "UTC";
const pause = () => new Promise((resolve) => setTimeout(resolve, 350));
const FAILED = "That change did not save. Try again.";

/** The Lists page over an in-memory store, with the detail sheet beside it saving through the real commands. */
export function ListsHarness({ empty, itemId }: { empty: boolean; itemId: string | null }) {
  const store = empty ? stores.empty : stores.full;
  const [version, setVersion] = useState(0);
  const [failing, setFailing] = useState(settings.failing);
  const [data, setData] = useState<ListsData | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; view: DetailView | null } | null>(null);

  useEffect(() => {
    void loadLists(store.repo, TZ).then(setData);
  }, [store, version]);

  useEffect(() => {
    const key = parseItemKey(itemId);
    if (!key || !itemId) return;
    let live = true;
    void loadDetail(store.repo, key, new Date(), TZ).then((view) => {
      if (live) setLoaded({ key: itemId, view });
    });
    return () => {
      live = false;
    };
  }, [store, itemId, version]);

  async function saved<R extends ActionResult>(result: R): Promise<R> {
    if (result.ok) setVersion((v) => v + 1);
    return result;
  }

  const actions: DetailActions = {
    ...harnessDetailActions(store.repo, TZ, async (command) => {
      await pause();
      return settings.failing ? { ok: false, error: FAILED } : saved(await command());
    }),
    newLinkedNote: async () => ({ ok: false, error: "Notes are not part of this harness." }),
  };

  // A failing capture fails in the repo, so the command's own words reach the field.
  async function capture(title: string): Promise<CaptureResult> {
    await pause();
    const fail = async (): Promise<never> => {
      throw new Error("harness: saves are set to fail");
    };
    return saved(await captureChecklist(settings.failing ? { ...store.repo, create: fail } : store.repo, title));
  }

  // The list is reloaded before the save resolves, so the tick never reads as undone in between.
  async function setDone(id: string, done: boolean): Promise<ActionResult> {
    await pause();
    if (settings.failing) return { ok: false, error: FAILED };
    const result = await setDoneCommand(store.repo, id, done, TZ);
    if (result.ok) setData(await loadLists(store.repo, TZ));
    return saved(result);
  }

  const current = loaded && loaded.key === itemId ? loaded : null;
  const detail = current ? (
    current.view ? (
      <DetailSheet key={current.key} view={current.view} actions={actions} />
    ) : (
      <MissingItem />
    )
  ) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-soft bg-paper-2 px-4 py-2 text-[13px] text-ink-2 rail:px-9">
        <span>Lists harness, in memory, times in UTC. Saves stay in this tab.</span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={failing}
            onChange={(e) => {
              settings.failing = e.target.checked;
              setFailing(e.target.checked);
            }}
          />
          Make every save fail
        </label>
      </div>
      {data && <ListsView data={data} detail={detail} capture={capture} setDone={setDone} />}
    </>
  );
}
