"use client";

import { useEffect, useState } from "react";
import { parseItemKey } from "@/domain/item-key";
import { loadDetail } from "@/features/detail/commands";
import { DetailSheet, MissingItem } from "@/features/detail/detail-sheet";
import type { DetailActions, DetailView } from "@/features/detail/model";
import { loadLists } from "@/features/lists/commands";
import { ListsView } from "@/features/lists/lists-view";
import type { ListsData } from "@/features/lists/model";
import { captureChecklist, type ActionResult, type CaptureResult } from "@/features/today/commands";
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
    void loadDetail(store.repo, key, TZ).then((view) => {
      if (live) setLoaded({ key: itemId, view });
    });
    return () => {
      live = false;
    };
  }, [store, itemId, version]);

  async function run<R extends ActionResult>(command: () => Promise<R>): Promise<R | { ok: false; error: string }> {
    await pause();
    if (settings.failing) return { ok: false, error: FAILED };
    const result = await command();
    if (result.ok) setVersion((v) => v + 1);
    return result;
  }

  const actions: DetailActions = {
    ...harnessDetailActions(store.repo, TZ, run),
    newLinkedNote: async () => ({ ok: false, error: "Notes are not part of this harness." }),
  };
  const capture = (title: string): Promise<CaptureResult> => run(() => captureChecklist(store.repo, title));

  const current = loaded && loaded.key === itemId ? loaded : null;
  const detail = current ? (
    current.view ? (
      <DetailSheet key={current.view.item.id} view={current.view} actions={actions} />
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
      {data && <ListsView data={data} detail={detail} capture={capture} />}
    </>
  );
}
