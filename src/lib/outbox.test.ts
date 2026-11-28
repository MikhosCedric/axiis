import { describe, expect, it } from "vitest";
import { enqueue, flush, markRefused, OUTBOX_FULL, OUTBOX_MAX, OUTBOX_MAX_AGE_MS, purgeStale, readOutbox, remove, retitle, type Sender } from "./outbox";

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const ids = (store: Storage, owner = "a") => readOutbox(store, owner).map((e) => e.title);

describe("the outbox", () => {
  it("keeps captures oldest first, per owner", () => {
    const store = memory();
    enqueue(store, "a", "one", 1);
    enqueue(store, "a", "two", 2);
    enqueue(store, "b", "other", 3);
    expect(ids(store)).toEqual(["one", "two"]);
    expect(ids(store, "b")).toEqual(["other"]);
  });

  it("refuses the next capture when full instead of dropping the oldest", () => {
    const store = memory();
    for (let i = 0; i < OUTBOX_MAX; i++) enqueue(store, "a", `n${i}`, i);
    expect(enqueue(store, "a", "late", 999)).toEqual({ ok: false, error: OUTBOX_FULL });
    expect(readOutbox(store, "a")[0].title).toBe("n0");
  });

  it("says so when storage is not available", () => {
    expect(enqueue(undefined, "a", "x", 1).ok).toBe(false);
    const broken = { ...memory(), setItem: () => { throw new Error("blocked"); } } as Storage;
    expect(enqueue(broken, "a", "x", 1).ok).toBe(false);
  });

  it("never sends one account's captures under another", async () => {
    const store = memory();
    enqueue(store, "alice", "alice's note", 1, "a1");
    enqueue(store, "bob", "bob's note", 2, "b1");
    const seen: string[] = [];
    const send: Sender = async (title) => (seen.push(title), { ok: true });
    await flush(store, "bob", send);
    expect(seen).toEqual(["bob's note"]);
    expect(ids(store, "alice")).toEqual(["alice's note"]);
  });

  it("purges entries older than the limit for every owner and keeps the rest", () => {
    const store = memory();
    const now = 10 * OUTBOX_MAX_AGE_MS;
    enqueue(store, "a", "old", now - OUTBOX_MAX_AGE_MS - 1);
    enqueue(store, "a", "new", now - 1000);
    enqueue(store, "gone", "old too", 5);
    purgeStale(store, now);
    expect(ids(store, "a")).toEqual(["new"]);
    expect(store.getItem("axiis-outbox:gone")).toBeNull();
  });

  it("ignores damaged data", () => {
    const store = memory();
    store.setItem("axiis-outbox:a", "{not json");
    expect(readOutbox(store, "a")).toEqual([]);
    store.setItem("axiis-outbox:a", JSON.stringify([{ id: 1 }, { id: "x", title: "ok", at: 5 }]));
    expect(ids(store)).toEqual(["ok"]);
  });

  it("sends in order and removes an entry only after the server answered", async () => {
    const store = memory();
    enqueue(store, "a", "one", 1, "id1");
    enqueue(store, "a", "two", 2, "id2");
    const seen: string[] = [];
    const send: Sender = async (title, entry) => {
      seen.push(`${title}:${entry.id}:${entry.at}:${entry.owner}`);
      return { ok: true };
    };
    expect(await flush(store, "a", send)).toEqual({ sent: 2, waiting: 0, notOwner: false });
    expect(seen).toEqual(["one:id1:1:a", "two:id2:2:a"]);
  });

  it("stops at no connection and keeps the rest", async () => {
    const store = memory();
    enqueue(store, "a", "one", 1, "id1");
    enqueue(store, "a", "two", 2, "id2");
    const send: Sender = async () => ({ ok: false, error: "offline", unreachable: true });
    expect(await flush(store, "a", send)).toEqual({ sent: 0, waiting: 2, notOwner: false });
  });

  it("stops when another account is signed in, keeping every entry unmarked for its owner", async () => {
    const store = memory();
    enqueue(store, "alice", "one", 1, "id1");
    enqueue(store, "alice", "two", 2, "id2");
    const owners: string[] = [];
    const send: Sender = async (_title, entry) => (owners.push(entry.owner), { ok: false, error: "not yours", notOwner: true });
    expect(await flush(store, "alice", send)).toEqual({ sent: 0, waiting: 2, notOwner: true });
    expect(owners).toEqual(["alice"]);
    expect(readOutbox(store, "alice").map((e) => [e.title, e.error])).toEqual([
      ["one", undefined],
      ["two", undefined],
    ]);
  });

  it("marks a refused entry, goes on, and does not send it again until edited", async () => {
    const store = memory();
    enqueue(store, "a", "bad", 1, "id1");
    enqueue(store, "a", "good", 2, "id2");
    const send: Sender = async (title) => (title === "bad" ? { ok: false, error: "Too long" } : { ok: true });
    expect(await flush(store, "a", send)).toEqual({ sent: 1, waiting: 1, notOwner: false });
    expect(readOutbox(store, "a")[0].error).toBe("Too long");

    const calls: string[] = [];
    await flush(store, "a", async (title) => (calls.push(title), { ok: true }));
    expect(calls).toEqual([]);

    retitle(store, "a", "id1", "fixed");
    await flush(store, "a", async (title) => (calls.push(title), { ok: true }));
    expect(calls).toEqual(["fixed"]);
  });

  it("removes and marks by id", () => {
    const store = memory();
    enqueue(store, "a", "one", 1, "id1");
    markRefused(store, "a", "id1", "no");
    expect(readOutbox(store, "a")[0].error).toBe("no");
    remove(store, "a", "id1");
    expect(readOutbox(store, "a")).toEqual([]);
    expect(store.length).toBe(0);
  });
});
