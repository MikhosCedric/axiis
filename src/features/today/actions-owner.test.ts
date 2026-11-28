import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRepo } from "./test-support";

// The capture action on its own, with the session and the repo stood in, so the owner check is what is tested.
const session = vi.hoisted(() => ({ owner: null as string | null, repo: null as unknown }));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/account", () => ({ getOutboxOwner: async () => session.owner }));
vi.mock("@/lib/items", () => ({ getItemsRepo: async () => session.repo }));
vi.mock("@/features/day/server", () => ({
  getNow: async () => new Date("2026-11-08T12:00:00Z"),
  getTimeZone: async () => "UTC",
  getWeekStart: async () => 1,
  areasNamedIn: async () => [],
}));

const { captureAction } = await import("./actions");
const { NOT_OWNER, ownedBySession } = await import("./commands");

const ID = "5b1f6b8e-3c0a-4f57-9a63-0d2d6f7a1c11";
const AT = Date.UTC(2026, 10, 8, 11);

describe("a queued capture sent after the account changed", () => {
  let repo: ReturnType<typeof fakeRepo>["repo"];
  beforeEach(() => {
    repo = fakeRepo().repo;
    session.repo = repo;
    session.owner = "bob";
  });

  it("is refused without storing anything when it belongs to another account", async () => {
    expect(await captureAction("alice's private note", { id: ID, at: AT, owner: "alice" })).toEqual(NOT_OWNER);
    expect(await repo.listInbox()).toEqual([]);
  });

  it("is refused when it names no owner, or no one is signed in", async () => {
    expect(await captureAction("no owner", { id: ID, at: AT })).toEqual(NOT_OWNER);
    session.owner = null;
    expect(await captureAction("signed out", { id: ID, at: AT, owner: "alice" })).toEqual(NOT_OWNER);
    expect(await repo.listInbox()).toEqual([]);
  });

  it("is stored when its owner is the account signed in", async () => {
    const result = await captureAction("bob's note", { id: ID, at: AT, owner: "bob" });
    expect(result.ok).toBe(true);
    expect((await repo.listInbox()).map((i) => i.title)).toEqual(["bob's note"]);
  });

  it("leaves a capture typed live alone", async () => {
    expect((await captureAction("typed now")).ok).toBe(true);
  });

  it("matches only the exact owner", () => {
    expect(ownedBySession(undefined, null)).toBe(true);
    expect(ownedBySession({ id: ID, at: AT, owner: "bob" }, "bob")).toBe(true);
    expect(ownedBySession({ id: ID, at: AT, owner: "bob" }, "Bob")).toBe(false);
    expect(ownedBySession({ id: ID, at: AT, owner: "bob" }, null)).toBe(false);
  });
});
