import { describe, expect, it } from "vitest";
import { reach, UNREACHABLE } from "./reach";

describe("reach", () => {
  it("passes an action's own answer through, refusals included", async () => {
    expect(await reach(Promise.resolve({ ok: true, id: "a" }))).toEqual({ ok: true, id: "a" });
    expect(await reach(Promise.resolve({ ok: false, error: "That area is not here any more." }))).toEqual({
      ok: false,
      error: "That area is not here any more.",
    });
  });

  it("turns a call that never reached the server into a refusal instead of a thrown error", async () => {
    expect(await reach(Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: UNREACHABLE });
  });
});
