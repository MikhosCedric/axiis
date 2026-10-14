import { describe, expect, it } from "vitest";
import { ItemsRepoError } from "@/lib/items/supabase-repo";
import { QUOTA_MESSAGE, RATE_MESSAGE, saveFailure } from "./quota";

const postgrest = (code: string, message = "refused") => ({ message, code });
const FALLBACK = "Try again.";

describe("saveFailure", () => {
  it("says the account is full for a quota refusal on a repo error's cause", () => {
    const error = new ItemsRepoError("items.create failed", { cause: postgrest("54000", "quota exceeded: at most 20000 items per account") });
    expect(saveFailure(error, FALLBACK)).toBe(QUOTA_MESSAGE);
  });

  it("says to slow down for a rate-limit refusal", () => {
    const error = new ItemsRepoError("items.create failed", { cause: postgrest("54R01", "rate limited: at most 120 items a minute per account") });
    expect(saveFailure(error, FALLBACK)).toBe(RATE_MESSAGE);
  });

  it("keeps the caller's sentence for other database errors and for errors with no code", () => {
    expect(saveFailure(new ItemsRepoError("items.create failed", { cause: postgrest("23505") }), FALLBACK)).toBe(FALLBACK);
    expect(saveFailure(new Error("network"), FALLBACK)).toBe(FALLBACK);
    expect(saveFailure(null, FALLBACK)).toBe(FALLBACK);
    expect(saveFailure({ code: "__proto__" }, FALLBACK)).toBe(FALLBACK);
  });

  it("stops on a cause that points back at itself", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(saveFailure(loop, FALLBACK)).toBe(FALLBACK);
  });
});
