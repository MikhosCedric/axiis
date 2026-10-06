import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/session", () => ({
  updateSession: async () => ({ response: NextResponse.next(), isAuthenticated: false }),
}));

const { proxy } = await import("./proxy");

const SECRET = "s".repeat(48);
const withCookie = (value: string) =>
  new NextRequest("http://localhost:3600/today", { headers: { cookie: `axiis-e2e-session=${value}` } });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("E2E_FAKE_SESSION", "1");
  vi.stubEnv("E2E_FAKE_SESSION_SECRET", SECRET);
  vi.stubEnv("VERCEL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy with the browser-test cookie", () => {
  it("lets the request through when the fake session is on", async () => {
    const response = await proxy(withCookie(SECRET));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends the request to /login when E2E_FAKE_SESSION is unset", async () => {
    vi.stubEnv("E2E_FAKE_SESSION", undefined);
    const response = await proxy(withCookie(SECRET));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3600/login?next=%2Ftoday");
  });

  it("sends the request to /login when the cookie is wrong", async () => {
    const response = await proxy(withCookie("t".repeat(48)));
    expect(response.headers.get("location")).toBe("http://localhost:3600/login?next=%2Ftoday");
  });
});
