import { describe, expect, it } from "vitest";
import { ItemsRepoError } from "@/lib/items/supabase-repo";
import { QUOTA_MESSAGE, isQuotaError, saveFailure } from "./quota";

const postgrest = (code: string) => ({ message: "quota exceeded: at most 20000 items per account", code });

describe("isQuotaError", () => {
  it("finds the quota code on a repo error's cause", () => {
    expect(isQuotaError(new ItemsRepoError("items.create failed", { cause: postgrest("54000") }))).toBe(true);
  });

  it("is false for other database errors and for errors with no code", () => {
    expect(isQuotaError(new ItemsRepoError("items.create failed", { cause: postgrest("23505") }))).toBe(false);
    expect(isQuotaError(new Error("network"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it("stops on a cause that points back at itself", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isQuotaError(loop)).toBe(false);
  });
});

describe("saveFailure", () => {
  it("says the account is full for a quota refusal and keeps the caller's sentence otherwise", () => {
    expect(saveFailure(new Error("x", { cause: postgrest("54000") }), "Try again.")).toBe(QUOTA_MESSAGE);
    expect(saveFailure(new Error("network"), "Try again.")).toBe("Try again.");
  });
});
