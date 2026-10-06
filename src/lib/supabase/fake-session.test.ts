import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFakeSession } from "./fake-session";

const SECRET = "a".repeat(20) + "0123456789abcdefghij";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
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

  it.each([
    ["NODE_ENV is production", () => vi.stubEnv("NODE_ENV", "production")],
    ["NODE_ENV is test", () => vi.stubEnv("NODE_ENV", "test")],
    ["the flag is unset", () => vi.stubEnv("E2E_FAKE_SESSION", undefined)],
    ["the flag is not exactly 1", () => vi.stubEnv("E2E_FAKE_SESSION", "true")],
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
