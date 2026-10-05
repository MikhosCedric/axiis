import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave, reduce, statusLabel, type AutosaveState, type SaveResult } from "./autosave";

describe("reduce", () => {
  const saving: AutosaveState = { kind: "saving", editedSince: false };

  it("does not call a save done when words changed while it was in flight", () => {
    const edited = reduce(saving, { type: "edit" });
    expect(edited).toEqual({ kind: "saving", editedSince: true });
    expect(reduce(edited, { type: "save-ok" })).toEqual({ kind: "dirty" });
    expect(reduce(saving, { type: "save-ok" })).toEqual({ kind: "saved" });
  });

  it("keeps the error on failure and lets a retry start from there", () => {
    const failed = reduce(saving, { type: "save-fail", error: "nope" });
    expect(failed).toEqual({ kind: "failed", error: "nope" });
    expect(reduce(failed, { type: "save-start" })).toEqual(saving);
  });

  it("does not start a save when nothing changed", () => {
    expect(reduce({ kind: "saved" }, { type: "save-start" })).toEqual({ kind: "saved" });
    expect(reduce({ kind: "idle" }, { type: "save-start" })).toEqual({ kind: "idle" });
  });

  it("labels each state in the product's words", () => {
    expect(statusLabel({ kind: "dirty" })).toBe("Saving");
    expect(statusLabel(saving)).toBe("Saving");
    expect(statusLabel({ kind: "saved" })).toBe("Saved");
    expect(statusLabel({ kind: "failed", error: "That did not save. Try again." })).toBe("That did not save. Try again.");
  });
});

describe("createAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(results: SaveResult[] = []) {
    const saved: string[] = [];
    const states: string[] = [];
    let release: (() => void) | null = null;
    let hold = false;
    const autosave = createAutosave<string>({
      delayMs: 700,
      onState: (s) => states.push(s.kind),
      save: (value) =>
        new Promise((resolve) => {
          saved.push(value);
          const answer = () => resolve(results.shift() ?? { ok: true });
          if (hold) release = answer;
          else answer();
        }),
    });
    return {
      autosave,
      saved,
      states,
      holdSaves: () => (hold = true),
      release: () => {
        hold = false;
        release?.();
      },
    };
  }

  it("saves the latest value once, 700 ms after the last edit", async () => {
    const { autosave, saved } = setup();
    autosave.edit("a");
    await vi.advanceTimersByTimeAsync(500);
    autosave.edit("ab");
    await vi.advanceTimersByTimeAsync(699);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(["ab"]);
    expect(autosave.state()).toEqual({ kind: "saved" });
  });

  it("saves at once on flush and does not save again after", async () => {
    const { autosave, saved } = setup();
    autosave.edit("a");
    await autosave.flush();
    expect(saved).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual(["a"]);
  });

  it("saves words typed during a save in a second save", async () => {
    const t = setup();
    t.holdSaves();
    t.autosave.edit("a");
    await vi.advanceTimersByTimeAsync(700);
    t.autosave.edit("ab");
    t.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.autosave.state()).toEqual({ kind: "dirty" });
    await vi.advanceTimersByTimeAsync(700);
    expect(t.saved).toEqual(["a", "ab"]);
    expect(t.autosave.state()).toEqual({ kind: "saved" });
  });

  it("flush waits for an in-flight save and then saves newer words", async () => {
    const t = setup();
    t.holdSaves();
    t.autosave.edit("a");
    await vi.advanceTimersByTimeAsync(700);
    t.autosave.edit("ab");
    const flushed = t.autosave.flush();
    t.release();
    await flushed;
    expect(t.saved).toEqual(["a", "ab"]);
    expect(t.autosave.state()).toEqual({ kind: "saved" });
  });

  it("shows a failure, keeps the words, and saves them on retry", async () => {
    const t = setup([{ ok: false, error: "That did not save. Try again." }]);
    t.autosave.edit("a");
    await t.autosave.flush();
    expect(t.autosave.state()).toEqual({ kind: "failed", error: "That did not save. Try again." });
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saved).toEqual(["a"]);
    await t.autosave.retry();
    expect(t.saved).toEqual(["a", "a"]);
    expect(t.autosave.state()).toEqual({ kind: "saved" });
  });

  it("treats a thrown save as a failure", async () => {
    const states: string[] = [];
    const autosave = createAutosave<string>({ onState: (s) => states.push(s.kind), save: () => Promise.reject(new Error("offline")) });
    autosave.edit("a");
    await autosave.flush();
    expect(autosave.state()).toEqual({ kind: "failed", error: "That did not save. Try again." });
  });

  it("tries again after the next edit when a save failed", async () => {
    const t = setup([{ ok: false, error: "x" }]);
    t.autosave.edit("a");
    await t.autosave.flush();
    t.autosave.edit("ab");
    await vi.advanceTimersByTimeAsync(700);
    expect(t.saved).toEqual(["a", "ab"]);
    expect(t.autosave.state()).toEqual({ kind: "saved" });
  });
});
