import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthRedirect } from "./redirect";

describe("resolveAuthRedirect", () => {
  it.each([
    ["/", "/login"],
    ["/today", "/login?next=%2Ftoday"],
    ["/items/abc", "/login?next=%2Fitems%2Fabc"],
    ["/login-ish", "/login?next=%2Flogin-ish"],
    ["/authx", "/login?next=%2Fauthx"],
  ])("sends a signed-out visitor on %s to %s", (pathname, expected) => {
    expect(resolveAuthRedirect({ pathname, isAuthenticated: false })).toBe(expected);
  });

  it.each(["/login", "/auth/callback", "/auth/signout"])("lets a signed-out visitor reach %s", (pathname) => {
    expect(resolveAuthRedirect({ pathname, isAuthenticated: false })).toBeNull();
  });

  it.each(["/", "/today", "/auth/callback", "/auth/signout"])("lets a signed-in user reach %s", (pathname) => {
    expect(resolveAuthRedirect({ pathname, isAuthenticated: true })).toBeNull();
  });

  it("sends a signed-in user away from the login page", () => {
    expect(resolveAuthRedirect({ pathname: "/login", isAuthenticated: true })).toBe("/");
  });

  describe("dev harness pages", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each(["/dev", "/dev/score"])("lets a signed-out visitor reach %s outside production", (pathname) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(resolveAuthRedirect({ pathname, isAuthenticated: false })).toBeNull();
    });

    it.each([
      ["/dev", "/login?next=%2Fdev"],
      ["/dev/score", "/login?next=%2Fdev%2Fscore"],
    ])("sends a signed-out visitor on %s to sign in, in production", (pathname, expected) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(resolveAuthRedirect({ pathname, isAuthenticated: false })).toBe(expected);
    });

    it("does not open look-alike paths", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(resolveAuthRedirect({ pathname: "/devices", isAuthenticated: false })).toBe("/login?next=%2Fdevices");
    });
  });
});
