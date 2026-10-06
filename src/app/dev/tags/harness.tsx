"use client";

import { useEffect, useState } from "react";
import type { TagSummary } from "@/domain/tag";
import { parseItemKey } from "@/domain/item-key";
import { loadDetail } from "@/features/detail/commands";
import { DetailSheet, MissingItem } from "@/features/detail/detail-sheet";
import type { DetailActions, DetailView } from "@/features/detail/model";
import { loadTagged, loadTagIndex, type TaggedData } from "@/features/tags/commands";
import { harnessDetailActions } from "../detail-actions";
import { TagIndexView } from "@/features/tags/tag-index-view";
import { TaggedView } from "@/features/tags/tagged-view";
import { setDone as setDoneCommand, type ActionResult } from "@/features/today/commands";
import { BASE, harnessTagHref, settings, store } from "./store";

const TZ = "UTC";
const pause = () => new Promise((resolve) => setTimeout(resolve, 350));

function Bar() {
  const [failing, setFailing] = useState(settings.failing);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-soft bg-paper-2 px-4 py-2 text-[13px] text-ink-2 rail:px-9">
      <span>Tags harness, in memory, times in UTC</span>
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
  );
}

export function TagIndexHarness() {
  const [tags, setTags] = useState<TagSummary[] | null>(null);
  useEffect(() => {
    void loadTagIndex(store.repo).then(setTags);
  }, []);
  return (
    <>
      <Bar />
      {tags && <TagIndexView tags={tags} hrefFor={harnessTagHref} />}
    </>
  );
}

/** A tag's page over the in-memory store, with the detail sheet beside it saving through the real commands. */
export function TaggedHarness({ name, itemId }: { name: string; itemId: string | null }) {
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<TaggedData | null | undefined>(undefined);
  const [loaded, setLoaded] = useState<{ key: string; view: DetailView | null } | null>(null);

  useEffect(() => {
    void loadTagged(store.repo, name, TZ).then(setData);
  }, [name, version]);

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
  }, [itemId, version]);

  const actions: DetailActions = {
    ...harnessDetailActions(store.repo, TZ, async (command) => {
      await pause();
      if (settings.failing) return { ok: false, error: "That change did not save. Try again." };
      const result = await command();
      if (result.ok) setVersion((v) => v + 1);
      return result;
    }),
    newLinkedNote: async () => ({ ok: false, error: "Notes are not part of this harness." }),
  };

  // The page is reloaded before the save resolves, so the tick never reads as undone in between.
  async function setDone(id: string, done: boolean): Promise<ActionResult> {
    await pause();
    if (settings.failing) return { ok: false, error: "That change did not save. Try again." };
    const result = await setDoneCommand(store.repo, id, done, TZ);
    if (result.ok) {
      setData(await loadTagged(store.repo, name, TZ));
      setVersion((v) => v + 1);
    }
    return result;
  }

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
      <Bar />
      {data === null && <p className="px-4 pt-8 text-ink-2 rail:px-9">No tag is called {name}.</p>}
      {data && <TaggedView data={data} indexHref={BASE} detail={detail} setDone={setDone} />}
    </>
  );
}
