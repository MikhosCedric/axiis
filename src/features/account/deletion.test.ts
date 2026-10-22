import { describe, expect, it } from "vitest";
import { memoryDeletionPort } from "@/lib/account/fake";
import { supabaseDeletionPort } from "@/lib/account/supabase";
import { deletionDue, scheduleDeletion, undoDeletion, type DeletionPort } from "./commands";

const failing: DeletionPort = {
  requestedAt: async () => null,
  request: async () => {
    throw new Error("relation account_deletions does not exist");
  },
  withdraw: async () => {
    throw new Error("network");
  },
};

describe("deletionDue", () => {
  it("is 14 days of real time after the request, across a clock change", () => {
    expect(deletionDue(new Date("2026-10-20T09:30:00Z")).toISOString()).toBe("2026-11-03T09:30:00.000Z");
  });
});

describe("scheduleDeletion and undoDeletion", () => {
  it("schedules once, keeps the first time when asked again, and undo clears it", async () => {
    let now = new Date("2026-10-20T09:30:00Z");
    const port = memoryDeletionPort(() => now);

    expect(await scheduleDeletion(port)).toEqual({ ok: true });
    now = new Date("2026-10-25T09:30:00Z");
    expect(await scheduleDeletion(port)).toEqual({ ok: true });
    expect(await port.requestedAt()).toEqual(new Date("2026-10-20T09:30:00Z"));

    expect(await undoDeletion(port)).toEqual({ ok: true });
    expect(await port.requestedAt()).toBeNull();
  });

  it("says nothing changed when the request or the undo fails", async () => {
    expect(await scheduleDeletion(failing)).toEqual({
      ok: false,
      error: "Your account was not scheduled for deletion, and nothing has changed. Try again in a moment.",
    });
    expect(await undoDeletion(failing)).toEqual({ ok: false, error: "The deletion was not undone yet. Try again in a moment." });
  });
});

describe("supabaseDeletionPort", () => {
  type Call = { op: string; args: unknown[] };

  function stub(reply: { data?: unknown; error?: { message: string } | null }) {
    const calls: Call[] = [];
    const builder = new Proxy({} as Record<string, unknown>, {
      get(_t, op: string) {
        if (op === "then") return (resolve: (v: unknown) => void) => resolve({ data: reply.data ?? null, error: reply.error ?? null });
        return (...args: unknown[]) => {
          calls.push({ op, args });
          return builder;
        };
      },
    });
    const db = { from: (table: string) => (calls.push({ op: "from", args: [table] }), builder) };
    return { db: db as never, calls };
  }

  it("reads the caller's row as a date, and null when there is none", async () => {
    const some = stub({ data: { requested_at: "2026-10-20T09:30:00+00:00" } });
    expect(await supabaseDeletionPort(some.db, "u1").requestedAt()).toEqual(new Date("2026-10-20T09:30:00Z"));
    expect(some.calls).toContainEqual({ op: "eq", args: ["user_id", "u1"] });
    expect(await supabaseDeletionPort(stub({ data: null }).db, "u1").requestedAt()).toBeNull();
  });

  it("asks with an insert that ignores a duplicate, so a second ask keeps the first date", async () => {
    const s = stub({});
    await supabaseDeletionPort(s.db, "u1").request();
    expect(s.calls).toContainEqual({ op: "upsert", args: [{ user_id: "u1" }, { onConflict: "user_id", ignoreDuplicates: true }] });
  });

  it("throws on a database error, so the command can say nothing changed", async () => {
    const s = stub({ error: { message: "permission denied" } });
    await expect(supabaseDeletionPort(s.db, "u1").withdraw()).rejects.toThrow(/account_deletions.delete failed/);
  });
});
