import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthRedirect } from "./redirect";

const signedOut = (pathname: string) => resolveAuthRedirect({ pathname, isAuthenticated: false });
const signedIn = (pathname: string) => resolveAuthRedirect({ pathname, isAuthenticated: true });

describe("resolveAuthRedirect", () => {
  it.each([
    ["/today", "/login?next=%2Ftoday"],
    ["/day/2026-10-06", "/login?next=%2Fday%2F2026-10-06"],
    ["/settings", "/login?next=%2Fsettings"],
    ["/items/abc", "/login?next=%2Fitems%2Fabc"],
  ])("sends a signed-out visitor on %s to %s", (pathname, expected) => {
    expect(signedOut(pathname)).toBe(expected);
  });

  it.each([
    "/",
    "/login",
    "/privacy",
    "/terms",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/icon.svg",
    "/opengraph-image",
    "/apple-icon",
    "/pwa-icon/192",
    "/pwa-icon/512",
    "/auth/callback",
    "/auth/signout",
  ])("lets a signed-out visitor reach %s", (pathname) => {
    expect(signedOut(pathname)).toBeNull();
  });

  it.each([
    "/login-ish",
    "/authx",
    "/privacy/x",
    "/privacy-policy",
    "/terms/",
    "/today/../privacy",
    "/robots.txt/x",
    "/icon.svgx",
    "/opengraph-images",
    "/apple-icon/x",
    "/pwa-icon",
    "/pwa-iconx/192",
    "/sitemap.xml.bak",
    "/manifest.json",
    "/settings/privacy",
    "/day/privacy",
  ])("does not open the look-alike %s", (pathname) => {
    expect(signedOut(pathname)).toBe(`/login?next=${encodeURIComponent(pathname)}`);
  });

  it.each(["/", "/today", "/day/2026-10-06", "/settings", "/privacy", "/terms", "/auth/callback", "/auth/signout"])(
    "lets a signed-in user reach %s",
    (pathname) => {
      expect(signedIn(pathname)).toBeNull();
    },
  );

  it("sends a signed-in user away from the login page to the landing page, which forwards to today", () => {
    expect(signedIn("/login")).toBe("/");
  });

  describe("dev harness pages", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each(["/dev", "/dev/score"])("lets a signed-out visitor reach %s outside production", (pathname) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(signedOut(pathname)).toBeNull();
    });

    it.each([
      ["/dev", "/login?next=%2Fdev"],
      ["/dev/score", "/login?next=%2Fdev%2Fscore"],
    ])("sends a signed-out visitor on %s to sign in, in production", (pathname, expected) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(signedOut(pathname)).toBe(expected);
    });

    it("lets a signed-out visitor reach them in the browser-test build, which runs as production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AXIIS_E2E_BUILD", "1");
      expect(signedOut("/dev/score")).toBeNull();
    });

    it("keeps the public pages public in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(signedOut("/")).toBeNull();
      expect(signedOut("/privacy")).toBeNull();
    });

    it("does not open look-alike paths", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(signedOut("/devices")).toBe("/login?next=%2Fdevices");
    });
  });
});
