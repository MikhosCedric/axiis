import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFakeSession } from "./fake-session";

const SECRET = "a".repeat(20) + "0123456789abcdefghij";

beforeEach(() => {
  vi.stubEnv("AXIIS_E2E_BUILD", "1");
  vi.stubEnv("E2E_FAKE_SESSION", "1");
  vi.stubEnv("E2E_FAKE_SESSION_SECRET", SECRET);
  vi.stubEnv("VERCEL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isFakeSession", () => {
  it("accepts the matching cookie when every condition holds", () => {
    expect(isFakeSession(SECRET)).toBe(true);
  });

  it("accepts it under `next start` too, since the browser tests run the production server", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isFakeSession(SECRET)).toBe(true);
  });

  it.each([
    ["the build is not the browser-test build", () => vi.stubEnv("AXIIS_E2E_BUILD", "")],
    ["the build flag is unset", () => vi.stubEnv("AXIIS_E2E_BUILD", undefined)],
    ["the build flag is not exactly 1", () => vi.stubEnv("AXIIS_E2E_BUILD", "true")],
    ["E2E_FAKE_SESSION is unset", () => vi.stubEnv("E2E_FAKE_SESSION", undefined)],
    ["E2E_FAKE_SESSION is not exactly 1", () => vi.stubEnv("E2E_FAKE_SESSION", "true")],
    ["VERCEL is set", () => vi.stubEnv("VERCEL", "1")],
    ["VERCEL is set but empty", () => vi.stubEnv("VERCEL", "")],
    ["the secret is unset", () => vi.stubEnv("E2E_FAKE_SESSION_SECRET", undefined)],
    ["the secret is empty", () => vi.stubEnv("E2E_FAKE_SESSION_SECRET", "")],
  ])("refuses when %s", (_, arrange) => {
    arrange();
    expect(isFakeSession(SECRET)).toBe(false);
  });

  it("refuses a short secret even when the cookie matches it", () => {
    const short = "x".repeat(31);
    vi.stubEnv("E2E_FAKE_SESSION_SECRET", short);
    expect(isFakeSession(short)).toBe(false);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["one character off", SECRET.slice(0, -1) + "k"],
    ["a prefix of the secret", SECRET.slice(0, -1)],
    ["the secret with more after it", SECRET + "x"],
    ["the same length in multibyte characters", "é".repeat(SECRET.length)],
  ])("refuses a cookie that is %s", (_, cookie) => {
    expect(isFakeSession(cookie)).toBe(false);
  });
});

describe("getFakePinnedMinutes", () => {
  const jar = new Map<string, string>();
  const pinned = async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }) }));
    return (await import("./fake-session")).getFakePinnedMinutes();
  };

  beforeEach(() => {
    jar.clear();
    jar.set("axiis-e2e-session", SECRET);
    jar.set("axiis-e2e-at", "11:50");
  });
  afterEach(() => {
    vi.doUnmock("next/headers");
  });

  it("reads the pinned time of day when every condition holds", async () => {
    expect(await pinned()).toBe(11 * 60 + 50);
  });

  it.each([
    ["the build is not the browser-test build", () => vi.stubEnv("AXIIS_E2E_BUILD", "")],
    ["E2E_FAKE_SESSION is unset", () => vi.stubEnv("E2E_FAKE_SESSION", undefined)],
    ["VERCEL is set", () => vi.stubEnv("VERCEL", "1")],
    ["the secret is too short", () => vi.stubEnv("E2E_FAKE_SESSION_SECRET", "x".repeat(31))],
    ["the session cookie is wrong", () => jar.set("axiis-e2e-session", "nope")],
    ["the session cookie is absent", () => jar.delete("axiis-e2e-session")],
    ["the time is not HH:MM", () => jar.set("axiis-e2e-at", "11:5")],
    ["the hour is out of range", () => jar.set("axiis-e2e-at", "24:00")],
    ["the pin is absent", () => jar.delete("axiis-e2e-at")],
  ])("is null when %s", async (_, arrange) => {
    arrange();
    expect(await pinned()).toBeNull();
  });
});
