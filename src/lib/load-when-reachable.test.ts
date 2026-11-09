import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWhenReachable } from "./reach";

/** A stand-in for the browser's connection state and its `online` event. */
function connection(onLine: boolean) {
  const events = new EventTarget();
  vi.stubGlobal("navigator", { onLine });
  vi.stubGlobal("window", events);
  return {
    comeBack: () => {
      vi.stubGlobal("navigator", { onLine: true });
      events.dispatchEvent(new Event("online"));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("loading a part of the page", () => {
  it("returns the part when it loads", async () => {
    connection(true);
    await expect(loadWhenReachable(async () => "part")).resolves.toBe("part");
  });

  it("waits for the connection when the load fails offline, then loads", async () => {
    const net = connection(false);
    const load = vi.fn().mockRejectedValueOnce(new Error("ChunkLoadError")).mockResolvedValue("part");
    let settled = false;
    const result = loadWhenReachable(load).then((v) => ((settled = true), v));
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);

    net.comeBack();
    await expect(result).resolves.toBe("part");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("still fails when the load fails online, since that is a real fault", async () => {
    connection(true);
    await expect(loadWhenReachable(() => Promise.reject(new Error("broken")))).rejects.toThrow("broken");
  });
});
