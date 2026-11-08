import { describe, expect, it } from "vitest";
import { captureTask, queuedId, typedAt } from "./commands";
import { fakeRepo } from "./test-support";

const NOW = new Date("2026-11-08T12:00:00Z");
const ID = "5b1f6b8e-3c0a-4f57-9a63-0d2d6f7a1c11";

describe("a capture queued offline", () => {
  it("stores one item however often it is sent", async () => {
    const { repo } = fakeRepo();
    const first = await captureTask(repo, "Buy milk", NOW, "UTC", null, ID as never);
    const again = await captureTask(repo, "Buy milk", NOW, "UTC", null, ID as never);
    expect(first.ok && again.ok && first.id === again.id).toBe(true);
    expect((await repo.listInbox()).filter((i) => i.title === "Buy milk")).toHaveLength(1);
  });

  it("reads 'tomorrow' from the day it was typed, not the day it was sent", async () => {
    const day = new Date("2026-11-08T12:00:00Z");
    expect(typedAt({ id: ID, at: Date.UTC(2026, 10, 6, 9) }, day)).toEqual(new Date(Date.UTC(2026, 10, 6, 9)));
  });

  it("falls back to now for an implausible time", () => {
    expect(typedAt({ id: ID, at: NOW.getTime() + 60_000 }, NOW)).toBe(NOW);
    expect(typedAt({ id: ID, at: NOW.getTime() - 31 * 86_400_000 }, NOW)).toBe(NOW);
    expect(typedAt({ id: ID, at: Number.NaN }, NOW)).toBe(NOW);
    expect(typedAt(undefined, NOW)).toBe(NOW);
  });

  it("ignores an id that is not a UUID", () => {
    expect(queuedId({ id: "not-a-uuid", at: 1 })).toBeUndefined();
    expect(queuedId({ id: ID, at: 1 })).toBe(ID);
  });
});
