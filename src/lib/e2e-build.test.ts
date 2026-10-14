import { afterEach, describe, expect, it, vi } from "vitest";
import { devHarnessEnabled } from "./dev-harness";

async function loadConfig() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the browser-test build flag in next.config", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["not exactly 1", "true"],
  ])("inlines an empty flag and builds into .next when AXIIS_E2E_BUILD is %s", async (_, value) => {
    vi.stubEnv("AXIIS_E2E_BUILD", value);
    vi.stubEnv("VERCEL", undefined);
    const config = await loadConfig();
    expect(config.env).toEqual({ AXIIS_E2E_BUILD: "" });
    expect(config.distDir).toBe(".next");
  });

  it("inlines 1 and builds into its own folder for the browser tests", async () => {
    vi.stubEnv("AXIIS_E2E_BUILD", "1");
    vi.stubEnv("VERCEL", undefined);
    const config = await loadConfig();
    expect(config.env).toEqual({ AXIIS_E2E_BUILD: "1" });
    expect(config.distDir).toBe(".next-e2e");
  });

  it("refuses to make the browser-test build on Vercel", async () => {
    vi.stubEnv("AXIIS_E2E_BUILD", "1");
    vi.stubEnv("VERCEL", "1");
    await expect(loadConfig()).rejects.toThrow(/never be set on Vercel/);
  });
});

describe("devHarnessEnabled", () => {
  it("is off in a normal production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AXIIS_E2E_BUILD", "");
    expect(devHarnessEnabled()).toBe(false);
  });

  it("is on in the browser-test build", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AXIIS_E2E_BUILD", "1");
    expect(devHarnessEnabled()).toBe(true);
  });

  it("is on in next dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AXIIS_E2E_BUILD", "");
    expect(devHarnessEnabled()).toBe(true);
  });
});
