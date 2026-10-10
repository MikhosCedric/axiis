import { describe, expect, it } from "vitest";
import { loginError } from "./errors";

describe("loginError", () => {
  it("names the known sign-in failures", () => {
    expect(loginError("link")).toMatch(/expired or was already used/);
    expect(loginError("google")).toMatch(/Google sign-in did not go through/);
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "", "other"])("finds nothing for %j", (code) => {
    expect(loginError(code)).toBeUndefined();
  });

  it("finds nothing when there is no code", () => {
    expect(loginError(undefined)).toBeUndefined();
  });
});
