import { describe, expect, it } from "vitest";
import type { Item, LocalDate } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { TAGS_PER_ITEM, TAGS_PER_USER } from "@/domain/tag";
import { setDone } from "@/features/today/commands";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { addTag, deleteTag, loadTagged, loadTagIndex, removeTag, renameTag, tagsOfShown } from "./commands";

const TZ = "UTC";
const d = (s: string) => s as LocalDate;

function world() {
  const task = makeItem({ title: "Write the brief" });
  const note = makeItem({ type: "note", title: "Garden ideas" });
  const series = makeItem({
    title: "Standup",
    schedule: { kind: "timed", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T09:15:00Z") },
    recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
  });
  const fake = fakeRepo([task, note, series], [area("Work")]);
  const namesOn = (item: Item) =>
    fake.itemTags.filter((l) => l.itemId === item.id).map((l) => fake.tags.find((t) => t.id === l.tagId)!.name);
  return { ...fake, task, note, series, namesOn, key: (on: string) => occurrenceKey(series.id, d(on)) };
}

describe("addTag", () => {
  it("makes a new tag and puts it on the item, in the case it was typed", async () => {
    const w = world();
    expect(await addTag(w.repo, w.task.id, "  #Deep   work ", TZ)).toEqual({ ok: true });
    expect(w.namesOn(w.task)).toEqual(["Deep work"]);
  });

  it("reuses a tag of the same name in any case, and adding it again changes nothing", async () => {
    const w = world();
    await addTag(w.repo, w.task.id, "Errands", TZ);
    await addTag(w.repo, w.note.id, "errands", TZ);
    await addTag(w.repo, w.note.id, "ERRANDS", TZ);
    expect(w.tags.map((t) => t.name)).toEqual(["Errands"]);
    expect(w.namesOn(w.note)).toEqual(["Errands"]);
    expect(w.calls.addTag).toHaveLength(2);
  });

  it("puts a tag on the series when given an occurrence, and an override of it too", async () => {
    const w = world();
    expect(await addTag(w.repo, w.key("2026-10-07"), "focus", TZ)).toEqual({ ok: true });
    await setDone(w.repo, w.key("2026-10-08"), true, TZ);
    const override = w.items.find((i) => i.recurrence.kind === "override")!;
    expect(await addTag(w.repo, override.id, "morning", TZ)).toEqual({ ok: true });
    expect(w.namesOn(w.series)).toEqual(["focus", "morning"]);
    expect(w.namesOn(override)).toEqual([]);
    expect(w.items.filter((i) => i.recurrence.kind === "override")).toHaveLength(1);
  });

  it("refuses a name with nothing in it or too long, and an item that is gone, writing nothing", async () => {
    const w = world();
    expect(await addTag(w.repo, w.task.id, " # ", TZ)).toEqual({ ok: false, error: "A tag needs 1 to 32 characters." });
    expect((await addTag(w.repo, w.task.id, "x".repeat(33), TZ)).ok).toBe(false);
    expect(await addTag(w.repo, "00000000-0000-4000-8000-0000000fffff", "a", TZ)).toEqual({ ok: false, error: "That item is not here any more." });
    expect((await addTag(w.repo, w.key("2026-10-01"), "before it starts", TZ)).ok).toBe(false);
    expect(w.calls.addTag).toEqual([]);
  });

  it("keeps an item to its limit, but an existing tag on it still counts as done", async () => {
    const w = world();
    w.tag(w.task.id, ...Array.from({ length: TAGS_PER_ITEM }, (_, i) => `t${i}`));
    expect(await addTag(w.repo, w.task.id, "one more", TZ)).toEqual({
      ok: false,
      error: `An item keeps up to ${TAGS_PER_ITEM} tags. Remove one to add another.`,
    });
    expect(await addTag(w.repo, w.task.id, "T3", TZ)).toEqual({ ok: true });
    expect(w.calls.addTag).toEqual([]);
  });

  it("keeps a user to their limit of tags, while existing ones can still go on more items", async () => {
    const w = world();
    w.tag(w.note.id, ...Array.from({ length: TAGS_PER_USER }, (_, i) => `t${i}`));
    expect((await addTag(w.repo, w.task.id, "new", TZ)).ok).toBe(false);
    expect(await addTag(w.repo, w.task.id, "t150", TZ)).toEqual({ ok: true });
    expect(w.namesOn(w.task)).toEqual(["t150"]);
  });

  it("says so when the save fails", async () => {
    const w = world();
    const repo = { ...w.repo, addTag: () => Promise.reject(new Error("down")) };
    expect(await addTag(repo, w.task.id, "x", TZ)).toEqual({ ok: false, error: "That change did not save. Try again." });
  });
});

describe("removeTag", () => {
  it("takes the tag off that item only, named in any case, and leaves the tag", async () => {
    const w = world();
    w.tag(w.task.id, "deep", "home");
    w.tag(w.note.id, "deep");
    expect(await removeTag(w.repo, w.task.id, "DEEP", TZ)).toEqual({ ok: true });
    expect(w.namesOn(w.task)).toEqual(["home"]);
    expect(w.namesOn(w.note)).toEqual(["deep"]);
    expect(await removeTag(w.repo, w.task.id, "deep", TZ)).toEqual({ ok: true });
  });

  it("takes a series' tag off from any occurrence", async () => {
    const w = world();
    w.tag(w.series.id, "focus");
    expect(await removeTag(w.repo, w.key("2026-10-09"), "focus", TZ)).toEqual({ ok: true });
    expect(w.namesOn(w.series)).toEqual([]);
  });
});

describe("renameTag and deleteTag", () => {
  it("renames a tag everywhere, and may change only its case", async () => {
    const w = world();
    w.tag(w.task.id, "deep");
    w.tag(w.note.id, "deep");
    const id = w.tags[0].id;
    expect(await renameTag(w.repo, id, "Focus")).toEqual({ ok: true });
    expect(await renameTag(w.repo, id, "FOCUS")).toEqual({ ok: true });
    expect([w.namesOn(w.task), w.namesOn(w.note)]).toEqual([["FOCUS"], ["FOCUS"]]);
  });

  it("refuses a name another tag has in any case, and a name with nothing in it", async () => {
    const w = world();
    w.tag(w.task.id, "deep", "Home");
    expect(await renameTag(w.repo, w.tags[0].id, "home")).toEqual({ ok: false, error: "You already have a tag called Home." });
    expect((await renameTag(w.repo, w.tags[0].id, "  ")).ok).toBe(false);
    expect(w.tags.map((t) => t.name)).toEqual(["deep", "Home"]);
  });

  it("deletes a tag from every item and keeps the items; deleting it again is fine", async () => {
    const w = world();
    w.tag(w.task.id, "deep");
    w.tag(w.note.id, "deep", "home");
    const id = w.tags[0].id;
    expect(await deleteTag(w.repo, id)).toEqual({ ok: true });
    expect(await deleteTag(w.repo, id)).toEqual({ ok: true });
    expect(w.tags.map((t) => t.name)).toEqual(["home"]);
    expect(w.namesOn(w.note)).toEqual(["home"]);
    expect(w.items).toHaveLength(3);
    expect(await deleteTag(w.repo, "not an id")).toEqual({ ok: false, error: "That tag is not here any more." });
  });
});

describe("reading tags", () => {
  it("names the tags each shown item wears in one read, occurrences and overrides taking the series'", async () => {
    const w = world();
    w.tag(w.series.id, "focus");
    w.tag(w.task.id, "home", "Deep");
    const orphan = makeItem({ recurrence: { kind: "override", seriesId: w.task.id, originalOn: d("2026-10-06") } });
    let reads = 0;
    const repo = { ...w.repo, tagsForItems: (ids: Parameters<typeof w.repo.tagsForItems>[0]) => (reads++, w.repo.tagsForItems(ids)) };
    const occurrence = { ...w.series, id: w.key("2026-10-07"), recurrence: { kind: "occurrence" as const, seriesId: w.series.id, originalOn: d("2026-10-07") } };

    expect(await tagsOfShown(repo, [w.task, w.note, occurrence, orphan], [w.series.id])).toEqual({
      [w.task.id]: ["Deep", "home"],
      [occurrence.id]: ["focus"],
    });
    expect(reads).toBe(1);
    expect(await tagsOfShown(repo, [], [])).toEqual({});
    expect(reads).toBe(1);
  });

  it("lists every tag by name with its open count", async () => {
    const w = world();
    w.tag(w.task.id, "home", "Deep");
    w.tag(w.note.id, "deep");
    w.task.status = "done";
    expect(await loadTagIndex(w.repo)).toEqual([
      expect.objectContaining({ name: "Deep", open: 1 }),
      expect.objectContaining({ name: "home", open: 0 }),
    ]);
  });

  it("lists a tag's items open first, with their other tags, and finds the tag in any case", async () => {
    const w = world();
    const done = makeItem({ title: "Old one", status: "done", createdAt: new Date("2026-10-07T00:00:00Z") });
    w.items.push(done);
    w.tag(w.task.id, "deep", "home");
    w.tag(done.id, "deep");
    w.tag(w.series.id, "deep");

    const data = await loadTagged(w.repo, "DEEP", TZ);
    expect(data?.tag.name).toBe("deep");
    expect(data?.rows.map((r) => [r.title, r.done, r.tags, r.when])).toEqual([
      ["Write the brief", false, ["home"], "Waiting for a time"],
      ["Standup", false, [], "Repeats every day"],
      ["Old one", true, [], "Waiting for a time"],
    ]);
    expect(await loadTagged(w.repo, "nothing", TZ)).toBeNull();
  });
});
