"use client";

import { useEffect, useState } from "react";
import type { Area } from "@/domain/item";
import type { TagSummary } from "@/domain/tag";
import type { AreaActions } from "@/features/account/areas-section";
import { addArea, deleteAccount, moveArea, removeArea, renameArea, setAreaColor } from "@/features/account/commands";
import { SettingsView } from "@/features/account/settings-view";
import { deleteTag, loadTagIndex, renameTag, setTagColor } from "@/features/tags/commands";
import type { TagActions } from "@/features/tags/tags-section";
import type { ActionResult } from "@/features/today/commands";
import { fakeAreasRepo } from "@/lib/areas/fake";
import type { ItemsRepo } from "@/lib/items/repo";
import { harnessTagHref, store as tagStore } from "../tags/store";

const pause = () => new Promise((resolve) => setTimeout(resolve, 450));

export function SettingsHarness() {
  const [{ repo, initial }] = useState(() => {
    const fake = fakeAreasRepo(["Work", "Home", "Health", "A longer area name that runs to forty"]);
    return { repo: fake.repo, initial: fake.rows.map(({ id, name, position, color }): Area => ({ id, name, position, color })) };
  });
  const [areas, setAreas] = useState(initial);
  const [failing, setFailing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function fake<A extends unknown[]>(command: (r: typeof repo, ...args: A) => Promise<ActionResult>) {
    return async (...args: A): Promise<ActionResult> => {
      await pause();
      if (failing) return { ok: false, error: "That change did not save. Try again." };
      const result = await command(repo, ...args);
      if (result.ok) setAreas(await repo.list());
      return result;
    };
  }

  const areaActions: AreaActions = {
    add: fake(addArea),
    rename: fake(renameArea),
    remove: fake(removeArea),
    move: fake(moveArea),
    color: fake(setAreaColor),
  };

  const [tags, setTags] = useState<TagSummary[]>([]);
  useEffect(() => {
    void loadTagIndex(tagStore.repo).then(setTags);
  }, []);

  function fakeTag<A extends unknown[]>(command: (r: ItemsRepo, ...args: A) => Promise<ActionResult>) {
    return async (...args: A): Promise<ActionResult> => {
      await pause();
      if (failing) return { ok: false, error: "That change did not save. Try again." };
      const result = await command(tagStore.repo, ...args);
      if (result.ok) setTags(await loadTagIndex(tagStore.repo));
      return result;
    };
  }

  const tagActions: TagActions = { rename: fakeTag(renameTag), remove: fakeTag(deleteTag), color: fakeTag(setTagColor) };

  async function fakeDelete(phrase: string): Promise<ActionResult> {
    await pause();
    return deleteAccount(
      {
        async deleteMyAccount() {
          if (failing) throw new Error("rpc failed");
          setLog((l) => [...l, "delete_my_account called"]);
        },
        async signOut() {
          setLog((l) => [...l, "signed out; the real action now redirects to /login?deleted=1"]);
        },
      },
      phrase,
    );
  }

  const [deletesOn, setDeletesOn] = useState<string | null>(null);
  function fakeSchedule(day: string | null) {
    return async (): Promise<ActionResult> => {
      await pause();
      if (failing) return { ok: false, error: "That change did not save. Try again." };
      setDeletesOn(day);
      return { ok: true };
    };
  }

  return (
    <div>
      <SettingsView
        email="sam@example.com"
        areas={areas}
        areaActions={areaActions}
        tags={tags}
        tagActions={tagActions}
        tagHref={harnessTagHref}
        deletion={{ schedule: fakeSchedule("Friday 6 November"), undo: fakeSchedule(null), deleteNow: fakeDelete }}
        deletesOn={deletesOn}
      />
      <aside className="mx-4 mb-10 max-w-[640px] border-t border-rule pt-4 text-ink-2 rail:mx-9">
        <p>
          Harness: areas and tags live in memory and every save waits a moment. Tags are the ones the tags harness shows.
          The export link points at the real route.
        </p>
        <label className="mt-2 flex items-center gap-2">
          <input type="checkbox" checked={failing} onChange={(e) => setFailing(e.target.checked)} />
          Make every save fail
        </label>
        {log.length > 0 && (
          <ul className="mt-2 list-disc pl-5">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
